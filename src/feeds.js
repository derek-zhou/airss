/*
 * The feeds schema, based on jsonfeed
 */

import {parseJSONItem, parseRSS2Item, parseATOMItem} from './items.js';

// keep at most 100 items from feed
const MaxKeptItems = 100;

const FeedType = {
    json: 0,
    rss2: 1,
    atom: 2
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

function parseJSONFeed(feed, json) {
    let newFeed = {...feed};
    newFeed.title = json.title;
    newFeed.feedUrl = json.feed_url;
    newFeed.homePageUrl = json.home_page_url;
    return newFeed;
}

function parseJSONItems(feed, json) {
    let items = [];
    for (let item of json.items.values()) {
	item = parseJSONItem(item);
	// duplicate info for the front end
	item.feedTitle = feed.title;
	item.feedId = feed.id;
	items = [...items, item];
	if (items.length >= MaxKeptItems)
	    break;
    }
    return items;
}

function parseRSS2Feed(feed, channel) {
    let newFeed = {...feed};
    const title = getXMLTextContent(channel, "title");
    const link = getXMLTextContent(channel, "link");
    const feedUrl = getXMLTextAttribute(channel, "atom:link[rel=self]", "href");
    if (title)
	newFeed.title = title;
    if (link)
	newFeed.homePageUrl = link;
    if (feedUrl)
	newFeed.feedUrl = feedUrl;
    return newFeed;
}

function parseRSS2Items(feed, channel) {
    let items = [];
    for (let item of channel.querySelectorAll("item").values()) {
	item = parseRSS2Item(item);
	// duplicate info for the front end
	item.feedTitle = feed.title;
	item.feedId = feed.id;
	items = [...items, item];
	if (items.length >= MaxKeptItems)
	    break;
    }
    return items;
}

function parseATOMFeed(feed, channel) {
    let newFeed = {...feed};
    const title = getXMLTextContent(channel, "title");
    const link = getXMLTextAttribute(channel, "link[rel=alternate]", "href");
    const feedUrl = getXMLTextAttribute(channel, "link[rel=self]", "href");
    if (title)
	newFeed.title = title;
    if (link)
	newFeed.homePageUrl = link;
    if (feedUrl)
	newFeed.feedUrl = feedUrl;
    return newFeed;
}

function parseATOMItems(feed, channel) {
    let items = [];
    for (let item of channel.querySelectorAll("item").values()) {
	item = parseATOMItem(item);
	// duplicate info for the front end
	item.feedTitle = feed.title;
	item.feedId = feed.id;
	items = [...items, item];
	if (items.length >= MaxKeptItems)
	    break;
    }
    return items;
}

function getXMLTextContent(elem, selector) {
    const sub = elem.querySelector(selector);
    if (sub)
	return sub.textContent;
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
    let response = await fetch(feed.feedUrl, {mode: 'no-cors'});
    if (response.status != 200)
	throw "loading failed in load";
    let updated = {...feed};
    let items = [];
    let now = new Date();
    let json, xml, parser, doc, channel;
    updated.lastLoadTime = now;

    switch (feed.type) {
    case FeedType.json:
	json = await response.json();
	updated = parseJSONFeed(updated, json);
	items = parseJSONItems(updated, json);
	break;
    case FeedType.rss2:
	xml = await response.text();
	parser = new DOMParser();
	doc = parser.parseFromString(xml, "application/xml");
	channel = doc.querySelector("channel");
	if (!channel)
	    throw "Malformed RSS2";
	updated = parseRSS2Feed(updated, channel);
	items = parseRSS2Items(updated, channel);
	break;
    case FeedType.atom:
	xml = await response.text();
	parser = new DOMParser();
	doc = parser.parseFromString(xml, "application/xml");
	channel = doc.querySelector("feed");
	if (!channel)
	    throw "Malformed ATOM";
	updated = parseATOMFeed(updated, channel);
	items = parseATOMItems(updated, channel);
	break;
    default:
	throw "Unkonwn feed type";
    }

    db.put(Store, updated);
    return items;
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
	return FeedType.atom;
    case "application/rss+xml":
    case "application/x-rss+xml":
    case "application/xml":
	return FeedType.rss2;
    default:
	return null;
    }
}

// return a feed object if url is ok, or throw
async function sanitize(url) {
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
	    feed.feedUrl = link.getAttribute("href");
	    feed.type = mimeToType(link.getAttribute("type"));
	    if (feed.feedUrl && (feed.type != null))
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
