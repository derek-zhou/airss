/*
 * networking loading module
 */

import {addFeed, updateFeed, getLoadCandidate} from './airss_model.js';

export {subscribe, load};

// keep at most 100 items from feed
const MaxKeptItems = 100;
// keep at most 180 days back
const MaxKeptPeriod = 180*24*3600*1000;

const FeedType = {
    json: 1,
    xml: 2
}

/*
 * callback side state and entry points
 */

// I have no state so far, just to serialize loading

async function cb_subscribe(prev, url) {
    await prev;
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
    addFeed(feed);
}

async function cb_load(prev) {
    await prev;
    let feed = await getLoadCandidate();
    if (!feed) {
	console.info("Nothing to load, sleeping");
	return;
    }
    try {
	var data = await loadFeed(feed);
    } catch (e) {
	if (typeof e === 'string' || (e instanceof TypeError)) {
	    feed.error = e.toString();
	    updateFeed(feed, []);
	    return;
	} else {
	    throw e;
	}
    }
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
    updateFeed(updated, items);
}

async function loadFeed(feed) {
    let response = await fetch(feed.feedUrl);
    if (response.status != 200)
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

// return a feed object if url is ok, or throw
async function sanitize(url) {
    // first we need to make sure it is a valid url. If not,
    // the next line will throw
    let urlObject = new URL(url);
    if (urlObject.protocol != 'http:' && urlObject.protocol != 'https:')
	throw "Only http(s) is supported";
    let feed = new Object();
    let response = await fetch(url);
    if (response.status != 200)
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
	    let type = mimeToType(link.getAttribute("type"));
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
    let count = 0;
    for (let item of rawItems.values()) {
	item = parseFunc(item);
	if (item && (now - item.datePublished <= MaxKeptPeriod)) {
	    // duplicate info for simple access
	    item.feedTitle = feed.title;
	    item.feedId = feed.id;
	    items = [...items, item];
	}
	count++;
	if (count >= MaxKeptItems)
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
	return null;
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
	tags = [...tags, category.textContent];
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
	return null;
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

function subscribe(url) {
    state = cb_subscribe(state, url);
    // piggy back loading
    state = cb_load(state);
}

function load() {
    state = cb_load(state);
}
