/*
 * The feeds schema, based on jsonfeed
 */

import {parseJSONItem, parseRSS2Item, parseATOMItem, oopsItem} from './items.js';

// keep at most 100 items from feed
const MaxKeptItems = 100;
// keep at most 180 days back
const MaxKeptPeriod = 180*24*3600*1000;

const FeedType = {
    json: 1,
    xml: 2
}

const SampleFeed = {
    id: 0,
    type: FeedType.json,
    feedUrl: "",
    homePageUrl: "",
    title: "",
    lastLoadTime: 0
};

export const Store = "feeds";

// in memory state
// feeds is an array of feed ids, in the order of last load time. feeds[0]
// is the oldest
let feeds = [];

// public apis
export {upgrade, load, get, first, loadItems, rotate,
	addFeed, removeFeed, sanitize};

function upgrade(db) {
    // the store holds all the feeds
    let store = db.createObjectStore(
	Store, {keyPath: "id", autoIncrement: true});
    store.createIndex("feedUrl", "feedUrl", {unique: true});
    store.createIndex("lastLoadTime", "lastLoadTime", {unique: false});
}

async function load(db) {
    let store = await db.transaction(Store).store;
    let index = store.index("lastLoadTime");
    let cursor = await index.openCursor();

    feeds = [];
    while (cursor) {
	feeds.push(cursor.value.id);
	cursor = await cursor.continue();
    }
}

function first() {
    return feeds.length > 0 ? feeds[0] : null;
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

async function loadItems(db, feed) {
    try {
	return await loadItemsThrow(db, feed);
    } catch (e) {
	if (typeof e === 'string' || (e instanceof TypeError)) {
	    // fake a item
	    let oops = oopsItem();
	    oops.feedTitle = feed.title;
	    oops.feedId = feed.id;
	    return [oops];
	} else {
	    throw e;
	}
    }
}

async function loadItemsThrow(db, feed) {
    let rawItems, updated, parseFunc;
    let response = await fetch(feed.feedUrl);
    if (response.status != 200)
	throw "loading failed in load";

    switch (feed.type) {
    case FeedType.json:
	let json = await response.json();
	updated = parseJSONFeed(feed, json);
	rawItems = json.items;
	parseFunc = parseJSONItem;
	break;
    case FeedType.xml:
	let xml = await response.text();
	let parser = new DOMParser();
	let doc = parser.parseFromString(xml, "text/xml");
	let rss2Feed = doc.querySelector("channel");
	let atomFeed = doc.querySelector("feed");
	if (rss2Feed) {
	    updated = parseRSS2Feed(feed, rss2Feed);
	    rawItems = rss2Feed.querySelectorAll("item");
	    parseFunc = parseRSS2Item;
	} else if (atomFeed) {
	    updated = parseATOMFeed(feed, atomFeed);
	    rawItems = atomFeed.querySelectorAll("entry");
	    parseFunc = parseATOMItem;
	} else {
	    throw "Malformed XML";
	}
	break;
    default:
	throw "Unkonwn feed type";
    }
    updated.lastLoadTime = new Date();
    await db.put(Store, updated);
    return processItems(rawItems, updated, parseFunc);
}

function rotate() {
    if (feeds.length == 0)
	return;
    let feedId = feeds.shift();
    feeds.push(feedId);
}

async function get(db, id) {
    return await db.get(Store, id);
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
	throw "loading failed in sanitize";
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

async function addFeed(db, feed) {
    let id = await db.add(Store, feed);
    console.log("added feed " + feed.feedUrl + " with id: " + id);
    feeds = [id, ...feeds];
}

async function removeFeed(db, id) {
    feeds = feeds.filter(i => i != id);
    await db.delete(Store, id);
}
