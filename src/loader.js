/*
 * networking loading module
 */

import * as Model from './airss_model.js';
import * as Airtable from './airtable_server.js';

export {subscribe, load, loadAirtable};

// keep at most 100 items from feed
const MaxKeptItems = localStorage.getItem("MAX_ITEMS_PER_FEED") || 100;
// kept in days
const MaxKeptPeriod = localStorage.getItem("MAX_KEPT_PERIOD") || 180;
// whether to load with bouncer
const BounceLoad = localStorage.getItem("BOUNCE_LOAD") == "true";
const BouncerRoot = "https://roastidio.us"
const Bouncer = BouncerRoot + "/bounce?url=";
const FeedType = {
    json: 1,
    xml: 2
}

/*
 * callback side state and entry points
 */

let enabled = true;

async function cb_loadFeedsFromAirtable(prev, feedIds) {
    await prev;
    // numeric sort
    feedIds.sort((a, b) => a - b);
    let localLastId = 0;
    if (feedIds.length > 0)
	localLastId = feedIds[feedIds.length - 1];
    let remoteLastId = 0;
    let remoteFeedIds = new Set();
    // add every feeds that exist in remote but not local
    // this is not in the sort order of lastLoadTime though
    while (true) {
	let remoteFeeds = await Airtable.loadFeedsBeyond(remoteLastId);
	if (remoteFeeds.length == 0)
	    break;
	for (let feed of remoteFeeds.values()) {
	    remoteFeedIds.add(feed.id);
	    if (feed.id > localLastId)
		Model.addFeed(feed);
	}
	remoteLastId = remoteFeeds[remoteFeeds.length - 1].id;
    }
    // two modes of action. if remote is empty, we push everything.
    // else we trust the remote and delete what remote doesn't have
    if (remoteLastId == 0) {
	for (let id of feedIds.values()) {
	    let feed = await Model.fetchFeed(id);
	    Airtable.insertFeed(feed);
	}
    } else {
	for (let id of feedIds.values()) {
	    if (remoteFeedIds.has(id))
		continue;
	    Model.deleteFeed(id);
	}
    }
}

async function cb_loadItemsFromAirtable(prev, itemIds) {
    await prev;
    let remoteLastId = 0;
    let localIds = new Set(itemIds);

    while (true) {
	let remoteIds = await Airtable.loadItemsBeyond(remoteLastId);
	let missingItems = [];
	if (remoteIds.length == 0)
	    break;
	for (let id of remoteIds.values()) {
	    if (!localIds.has(id)) {
		let item = await Airtable.fetchItem(id);
		console.info("fetched missing item " + item.url + " with id: " + item.id);
		missingItems.push(item);
	    }
	}
	Model.addItems(missingItems);
	remoteLastId = remoteIds[remoteIds.length - 1];
    }
}

async function cb_subscribe(prev, url) {
    await prev;
    if (!enabled)
	return;
    let feed;
    try {
	feed = await sanitize(url);
    } catch (e) {
	if (typeof e === 'string' || (e instanceof TypeError)) {
	    feed = {
		feedUrl: url,
		error: e.toString()
	    };
	} else {
	    throw e;
	}
    }
    if (feed)
	Model.addFeed(feed);
    else
	Model.warn("Unauthorized. Please either load directly or login to <a href=\""
		   + BouncerRoot + "\">roastidio.us</a> then reload Airss");
}

async function cb_load(prev) {
    await prev;
    if (!enabled)
	return;
    let feed = await Model.getLoadCandidate();
    if (!feed) {
	console.info("Nothing to load, sleeping");
	return;
    }
    let data;
    try {
	data = await loadFeed(feed);
    } catch (e) {
	if (typeof e === 'string' || (e instanceof TypeError)) {
	    feed.error = e.toString();
	    Model.updateFeed(feed, []);
	    return;
	} else {
	    throw e;
	}
    }
    if (data) {
	let updated = feed;
	let items = [];
	switch (feed.type) {
	case FeedType.json:
	    updated = parseJSONFeed(feed, data);
	    if (data.items)
		items = processItems(data.items, updated, parseJSONItem);
	    break;
	case FeedType.xml:
	    let rss2Feed = data.querySelector("channel");
	    let atomFeed = data.querySelector("feed");
	    if (rss2Feed) {
		updated = parseRSS2Feed(feed, rss2Feed);
		items = processItems(rss2Feed.querySelectorAll("item"),
				     updated, parseRSS2Item);
	    } else if (atomFeed) {
		updated = parseATOMFeed(feed, atomFeed);
		items = processItems(atomFeed.querySelectorAll("entry"),
				     updated, parseATOMItem);
	    }
	    break;
	}
	Model.updateFeed(updated, items);
    } else {
	Model.warn("Unauthorized. Please either load directly or login to <a href=\""
		   + BouncerRoot + "\">roastidio.us</a> then reload Airss");
    }
}

function myFetch(url) {
    if (BounceLoad) {
	return fetch(Bouncer + encodeURIComponent(url), {
	    mode: "cors",
	    credentials: "include",
	    redirect: "error"
	});
    } else {
	return fetch(url);
    }
}

async function loadFeed(feed) {
    let response = await myFetch(feed.feedUrl);
    if (BounceLoad && response.status == 401) {
	enabled = false;
	return false;
    }
    else if (response.status != 200)
	throw "fetching failed in loadFeed";
    switch (feed.type) {
    case FeedType.json:
	return response.json();
    case FeedType.xml:
	let parser = new DOMParser();
	let text = await response.text();
	let doc = parser.parseFromString(text, "text/xml");
	if (doc.documentElement.tagName == 'parsererror')
	    throw doc.documentElement.textContent;
	return doc;
    }
    throw "internal error in loadFeed";
}

function mimeToType(mime) {
    switch (mime) {
    case "application/json":
    case "application/feed+json":
	return FeedType.json;
    case "application/atom+xml":
    case "application/rss+xml":
    case "application/x-rss+xml":
    case "application/xml":
    case "text/xml":
	return FeedType.xml;
    default:
	return null;
    }
}

function strictMimeToType(mime) {
    switch (mime) {
    case "application/feed+json":
	return FeedType.json;
    case "application/atom+xml":
    case "application/rss+xml":
	return FeedType.xml;
    default:
	return null;
    }
}

// return a feed object if url is ok, or throw
async function sanitize(url) {
    // first we need to make sure it is a valid url. If not,
    // the next line will throw
    let urlObject = new URL(url);
    if (urlObject.protocol != 'http:' && urlObject.protocol != 'https:')
	throw "Only http(s) is supported";
    let feed = new Object();
    let response = await myFetch(url);
    if (BounceLoad && response.status == 401) {
	enabled = false;
	return false;
    }
    else if (response.status != 200)
	throw "fetching failed in sanitize";
    let mime = response.headers.get('Content-Type');
    let parts = mime.split(/\s*;\s*/);
    mime = parts[0];
    feed.feedUrl = url;
    feed.lastLoadTime = 0;
    feed.type = mimeToType(mime);
    if (feed.type != null)
	return feed;

    switch (mime) {
    case "text/html":
    case "application/xhtml+xml":
	const parser = new DOMParser();
	const html = await response.text();
	const doc = parser.parseFromString(html, "text/html");
	const links = doc.head.querySelectorAll("link[rel=alternate]");
	for (let link of links.values()) {
	    let href = link.getAttribute("href");
	    let type = strictMimeToType(link.getAttribute("type"));
	    if (!href)
		continue;
	    if (!type)
		continue;
	    feed.type = type;
	    let mergedUrl = new URL(href, url);
	    feed.feedUrl = mergedUrl.toString();
	    return feed;
	}
    }
    throw "Unrecognized mime";
}

function processItems(rawItems, feed, parseFunc) {
    let now = new Date();
    let items = [];
    for (let item of rawItems.values()) {
	item = parseFunc(item);
	if (!item)
	    continue;
	if (now - item.datePublished <= MaxKeptPeriod*24*3600*1000) {
	    // duplicate info for simple access
	    item.feedTitle = feed.title;
	    item.feedId = feed.id;
	    items = [...items, item];
	    if (items.length >= MaxKeptItems)
		break;
	} else
	    break;
    }
    return items;
}

function parseJSONFeed(feed, json) {
    let newFeed = {...feed};
    newFeed.title = json.title;
    if (json.home_page_url)
	newFeed.homePageUrl = json.home_page_url;
    return newFeed;
}

function parseRSS2Feed(feed, channel) {
    let newFeed = {...feed};
    const title = getXMLTextContent(channel, "title");
    const link = getXMLTextContent(channel, "link");
    newFeed.title = title;
    if (link)
	newFeed.homePageUrl = link;
    return newFeed;
}

function parseATOMFeed(feed, channel) {
    let newFeed = {...feed};
    const title = getXMLTextContent(channel, "title");
    const link = getXMLTextAttribute(channel, "link[rel=alternate]", "href");
    newFeed.title = title;
    if (link)
	newFeed.homePageUrl = link;
    return newFeed;
}

function getXMLTextContent(elem, selector) {
    const sub = elem.querySelector(selector);
    if (sub)
	return sub.textContent.trim();
    else
	return null;
}

function getXMLTextAttribute(elem, selector, attr) {
    const sub = elem.querySelector(selector);
    if (sub)
	return sub.getAttribute(attr);
    else
	return null;
}

function parseJSONItem(json) {
    let item = new Object();
    item.datePublished = new Date(json.date_published);
    if (json.content_html !== undefined)
	item.contentHtml = json.content_html;
    else if (json.content_text !== undefined)
	item.contentHtml = '<p>' + json.content_text + '</p>';
    else
	return null;
    if (json.url)
	item.url = json.url;
    else
	return null;
    item.imageUrl = json.image;
    item.title = json.title;
    if (json.tags)
	item.tags = json.tags;
    else
	item.tags = [];
    return item;
}

function parseRSS2Item(elem) {
    let item = new Object();
    const pubDate = getXMLTextContent(elem, "pubDate");
    const description = getXMLTextContent(elem, "description");
    // there is no way to select XML namespace.
    // Hopefully there is no other encoded than content:encoded
    const content = getXMLTextContent(elem, "*|encoded");
    const link = getXMLTextContent(elem, "link");
    const title = getXMLTextContent(elem, "title");
    const enclosure = getXMLTextAttribute(elem, "enclosure", "url");
    const enclosure_type = getXMLTextAttribute(elem, "enclosure", "type");
    const categories = elem.querySelectorAll("category");
    let tags = [];
    for (let category of categories.values()) {
	tags = [...tags, category.textContent];
    }
    if (pubDate)
	item.datePublished = new Date(pubDate);
    if (content)
	item.contentHtml = content;
    else if (description)
	item.contentHtml = description;
    else
	item.contentHtml = "";
    if (enclosure_type) {
	const tokens = enclosure_type.split('/');
	if (tokens[0] == 'image')
	    item.imageUrl = enclosure;
    }
    if (link)
	item.url = link;
    else
	return null;
    if (title)
	item.title = title;
    item.tags = tags;
    return item;
}

function parseATOMItem(elem) {
    let item = new Object();
    const published = getXMLTextContent(elem, "published");
    const updated = getXMLTextContent(elem, "updated");
    const content = getXMLTextContent(elem, "content");
    const summary = getXMLTextContent(elem, "summary");
    const link = getXMLTextAttribute(elem, "link", "href");
    const alternate = getXMLTextAttribute(elem, "link[rel=alternate]", "href");
    const enclosure = getXMLTextAttribute(elem, "link[rel=enclosure]", "href");
    const enclosure_type = getXMLTextAttribute(elem, "link[rel=enclosure]", "type");
    const title = getXMLTextContent(elem, "title");
    const categories = elem.querySelectorAll("category");
    let tags = [];
    for (let category of categories.values()) {
	tags = [...tags, category.getAttribute("term")];
    }
    if (published)
	item.datePublished = new Date(published);
    else if (updated)
	item.datePublished = new Date(updated);
    if (content)
	item.contentHtml = content;
    else if (summary)
	item.contentHtml = '<p>' + summary + '</p>';
    else
	item.contentHtml = "";
    if (enclosure_type) {
	const tokens = enclosure_type.split('/');
	if (tokens[0] == 'image')
	    item.imageUrl = enclosure;
    }
    if (alternate)
	item.url = alternate;
    else if (link)
	item.url = link;
    else
	return null;
    if (title)
	item.title = title;
    item.tags = tags;
    return item;
}

/*
 * client side state
 */

let state = null;

function loadAirtable(feedIds, itemIds) {
    state = cb_loadFeedsFromAirtable(state, feedIds);
    state = cb_loadItemsFromAirtable(state, itemIds);
}

function subscribe(url) {
    state = cb_subscribe(state, url);
    // piggy back loading
    state = cb_load(state);
}

function load() {
    state = cb_load(state);
}
