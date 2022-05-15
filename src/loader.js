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
const Buffer = BouncerRoot + "/buffer";
const FeedType = {
    json: 1,
    xml: 2
}

const attributeSet = new Set(['alt', 'height', 'href', 'type', 'src', 'width']);
const tagSet = new Set(['A', 'ABBR', 'ADDR', 'ARTICLE', 'ASIDE', 'AUDIO', 'B', 'BLOCKQUOTE',
			'BR', 'CAPTION', 'CITE', 'CODE', 'COL', 'COLGROUP', 'DD', 'DEL', 'DFN',
			'DIV', 'DL', 'DT', 'EM', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'HEADER',
			'HGROUP', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'I', 'IMG', 'INS',
			'LABEL', 'LI', 'LINK', 'MAIN', 'MARK', 'NAV', 'OL', 'P', 'PICTURE',
			'PRE', 'Q', 'S', 'SAMP', 'SECTION', 'SMALL', 'SOURCE', 'SPAN', 'STRONG',
			'SUB', 'SUP', 'SVG', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD',
			'TIME', 'TR', 'TRACK', 'U', 'UL', 'VIDEO', 'WBR']);

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
    try {
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
    } catch (e) {
	console.error("Failed to load airtable. check your configuration");
	Model.error("Failed to load airtable. check your configuration");
	return null;
    }
}

async function cb_loadItemsFromAirtable(prev, itemIds) {
    await prev;
    let remoteLastId = 0;
    let localIds = new Set(itemIds);

    try {
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
    } catch (e) {
	console.error("Failed to load airtable. check your configuration");
	Model.error("Failed to load airtable. check your configuration");
	return null;
    }
    Model.loadingDone();
}

async function cb_subscribe(prev, url) {
    await prev;
    if (!enabled)
	return;
    try {
	Model.loadingStart();
	let feed = await sanitize(url);
	if (!feed)
	    Model.warn("Unauthorized. Please login to <a href=\""
		       + BouncerRoot + "\">roastidio.us</a> then reload Airss");
	Model.loadingDone();
    } catch (e) {
	if (typeof e === 'string' || (e instanceof TypeError)) {
	    Model.error("The feed '" + url + "' is not valid");
	    console.error("The feed '" + url + "' is not valid: " + e);
	    Model.loadingDone();
	    return;
 	} else {
	    Model.loadingDone();
	    throw e;
	}
    }
}

async function cb_load(prev) {
    await prev;
    if (!enabled)
	return;
    let obj = await Model.getLoadCandidate();
    if (!obj) {
	console.info("Nothing to load, sleeping");
	return;
    }
    try {
	Model.loadingStart();
	let ret = await loadFeed(obj.feed, obj.items);
	if (ret)
	    Model.updateFeed(ret.updated, ret.items);
	else
	    Model.warn("Unauthorized. Please login to <a href=\""
		       + BouncerRoot + "\">roastidio.us</a> then reload Airss");
	Model.loadingDone();
    } catch (e) {
	if (typeof e === 'string' || (e instanceof TypeError)) {
	    obj.feed.error = e.toString();
	    Model.updateFeed(obj.feed, []);
	    Model.loadingDone();
	    return;
	} else {
	    Model.loadingDone();
	    throw e;
	}
    }
}

function myFetch(url) {
    if (BounceLoad && !url.startsWith(BouncerRoot)) {
	return fetch(Bouncer + encodeURIComponent(url), {
	    mode: "cors"
	});
    } else {
	return fetch(url);
    }
}

function bufferFetch(url, except) {
    if (BounceLoad) {
	return fetch(Buffer, {
	    method: "POST",
	    headers: {
		'Accept': 'application/json',
		'Content-Type': 'application/json'
	    },
	    body: JSON.stringify({url: url, except: except}),
	    mode: "cors"
	});
    } else {
	return fetch(url);
    }
}

async function loadFeed(feed, except) {
    let response = await bufferFetch(feed.feedUrl, except);
    let updated = {...feed};
    if (BounceLoad && response.status == 401) {
	enabled = false;
	return false;
    }
    else if (response.status != 200)
	throw "fetching failed in loadFeed";

    if (response.redirected) {
	console.info(feed.feedUrl + " redirected to: " + response.url);
	if (BounceLoad) {
	    let urlObject = new URL(response.url);
	    let search = urlObject.searchParams;
	    let feedUrl = search.get('url');
	    updated.feedUrl = feedUrl;
	} else {
	    updated.feedUrl = response.url;
	}
    }
    // buffer load is always in JSON
    if (BounceLoad) {
	let data = await response.json();
	if (data.error)
	    throw data.error;
	updated = parseJSONFeed(updated, data);
	let items = processItems(data.items, updated, parseJSONItem, false);
	return {updated: updated, items: items};
    }
    switch (feed.type) {
    case FeedType.json:
	let data = await response.json();
	updated = parseJSONFeed(updated, data);
	let items = processItems(data.items, updated, parseJSONItem, true);
	return {updated: updated, items: items};
    case FeedType.xml:
	let parser = new DOMParser();
	let text = await response.text();
	let doc = parser.parseFromString(text, "text/xml");
	if (doc.documentElement.tagName == 'parsererror')
	    throw doc.documentElement.textContent;
	let rss2Feed = doc.querySelector("channel");
	if (rss2Feed) {
	    updated = parseRSS2Feed(updated, rss2Feed);
	    let items = processItems(rss2Feed.querySelectorAll("item"), updated, parseRSS2Item, true);
	    return {updated: updated, items: items};
	}
	let atomFeed = doc.querySelector("feed");
	if (atomFeed) {
	    updated = parseATOMFeed(updated, atomFeed);
	    let items = processItems(atomFeed.querySelectorAll("entry"), updated, parseATOMItem, true);
	    return {updated: updated, items: items};
	}
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

async function loadInitFeed(response, feed) {
    switch (feed.type) {
    case FeedType.json:
	let data = await response.json();
	let updated = parseJSONFeed(feed, data);
	let items = processItems(data.items, updated, parseJSONItem, true);
	Model.updateFeed(updated, items);
	return updated;
    case FeedType.xml:
	let parser = new DOMParser();
	let text = await response.text();
	let doc = parser.parseFromString(text, "text/xml");
	if (doc.documentElement.tagName == 'parsererror')
	    throw doc.documentElement.textContent;
	let rss2Feed = doc.querySelector("channel");
	if (rss2Feed) {
	    let updated = parseRSS2Feed(feed, rss2Feed);
	    let items = processItems(rss2Feed.querySelectorAll("item"), updated, parseRSS2Item, true)
	    Model.updateFeed(updated, items);
	    return updated;
	}
	let atomFeed = doc.querySelector("feed");
	if (atomFeed) {
	    let updated = parseATOMFeed(feed, atomFeed);
	    let items = processItems(atomFeed.querySelectorAll("entry"), updated, parseATOMItem, true)
	    Model.updateFeed(updated, items);
	    return updated;
	}
    }
    throw "Illegal feed content";
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
    } else if (response.status != 200)
	throw "fetching failed in sanitize";

    if (response.redirected) {
	console.info(url + " redirected to: " + response.url);
	if (BounceLoad && !url.startsWith(BouncerRoot)) {
	    let urlObject = new URL(response.url);
	    let search = urlObject.searchParams;
	    let feedUrl = search.get('url');
	    url = feedUrl;
	} else {
	    url = response.url;
	}
    }
    let mime = response.headers.get('Content-Type');
    let parts = mime.split(/\s*;\s*/);
    mime = parts[0];
    feed.feedUrl = url;
    feed.lastLoadTime = 0;
    feed.lastFetchTime = 0;
    feed.type = mimeToType(mime);
    if (feed.type != null)
	return await loadInitFeed(response, feed);

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
	    let response = await myFetch(feed.feedUrl);
	    if (BounceLoad && response.status == 401) {
		enabled = false;
		return false;
	    }
	    else if (response.status != 200) {
		throw "fetching failed in sanitize";
	    }
	    return await loadInitFeed(response, feed);
	}
	throw "No feed discovered";
    }
    throw "Unrecognized mime";
}

function sanitizeText(input) {
    var iframe = document.querySelector("iframe#sanitizer");
    var iframe_body = iframe.contentDocument.body;
    iframe_body.innerHTML = input;
    return iframe_body.textContent;
}

function sanitizeHtml(input) {
    var iframe = document.querySelector("iframe#sanitizer");
    var iframe_body = iframe.contentDocument.body;
    iframe_body.innerHTML = input;
    var sanitized = iframe.contentDocument.createElement('Body');
    sanitizeChildren(iframe_body, iframe.contentDocument, sanitized);
    return sanitized.innerHTML;
}

function sanitizeChildren(node, container, newNode) {
    for (let i = 0; i < node.childNodes.length; i++) {
	let subNode = sanitizeNode(node.childNodes[i], container);
	if (subNode)
            newNode.appendChild(subNode);
    }
}

function sanitizeAttributes(node, newNode) {
    for (let i = 0; i < node.attributes.length; i++) {
	let attr = node.attributes[i];
	if (attributeSet.has(attr.name) && attr.value.indexOf("javascript:") != 0)
	    newNode.setAttribute(attr.name, attr.value);
    }
}

function sanitizeNode(node, container) {
    if (node.nodeType == Node.TEXT_NODE) {
        return node.cloneNode(true);
    } else if (node.nodeType == Node.ELEMENT_NODE && tagSet.has(node.tagName)) {
	let newNode = container.createElement(node.tagName);
	sanitizeAttributes(node, newNode);
	sanitizeChildren(node, container, newNode);
	return newNode;
    }
}

function processItems(rawItems, feed, parseFunc, sanitize) {
    let now = new Date();
    let items = [];
    let counter = 0;

    if (rawItems) {
	for (let item of rawItems.values()) {
	    // never look pass more than MaxKeptItems from the top. Some feeds are long
	    if (counter > MaxKeptItems)
		break;
	    else
		counter ++;
	    item = parseFunc(item);
	    // some items are invalid
	    if (!item)
		continue;
	    else if (item.datePublished > now)
		continue;
	    else if (now - item.datePublished <= MaxKeptPeriod*24*3600*1000) {
		// duplicate info for simple access
		item.feedTitle = feed.title;
		item.feedId = feed.id;
		item.title = sanitizeText(item.title);
		item.contentHtml = sanitize ? sanitizeHtml(item.contentHtml) : item.contentHtml;
		items = [...items, item];
	    }
	}
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

function enforceURL(url) {
    try {
	let absUrl = new URL(url);
	return absUrl.toString();
    } catch(e) {
	return null;
    }
}

function parseJSONItem(json) {
    let item = new Object();
    item.datePublished = new Date(json.date_published);
    if (json.content_html !== undefined)
	item.contentHtml = json.content_html;
    else if (json.content_text !== undefined)
	item.contentHtml = '<p>' + json.content_text + '</p>';
    else
	item.contentHtml = "";
    item.url = enforceURL(json.url);
    if (!item.url || !item.datePublished)
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
    item.url = enforceURL(link);
    if (!item.url || !item.datePublished)
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
	item.url = enforceURL(alternate);
    else
	item.url = enforceURL(link);
    if (!item.url || !item.datePublished)
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
