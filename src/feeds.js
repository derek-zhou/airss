/*
 * The feeds schema, based on jsonfeed
 */

import {parseJSONItem} from './items.js';

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
    feeds.length() > 0 ? feeds[0] : null;
}

function parseJSONFeed(feed, json) {
    let now = new Date();
    let newFeed = feed.clone();
    newFeed.lastLoadTime = now;
    newFeed.title = json.title;
    newFeed.feedUrl = json.feed_url;
    newFeed.homePageUrl = json.home_page_url;
    return newFeed;
}

function parseJSONItems(feed, json) {
    return json.items.splice(0, MaxKeptItems)
	.map(each => {
	    let item = parseJSONItem(each);
	    // duplicate info for the front end
	    item.feedTitle = feed.title;
	    item.feedId = feed.id;
	    return item;
	});
}

async function loadItems(db, feed) {
    let response = await fetch(feed.feedUrl);
    switch (feed.type) {
    case FeedType.json:
	let json = await response.json();
	let feed = parseJSONFeed(feed, json);
	let items = parseJSONItems(feed, json);
	db.put(Store, feed);
	return items;
    default:
	throw "Unkonwn feed type";
    }
}

function rotate() {
    if (feeds.length() == 0)
	return;
    let feedId = feeds.shift();
    feeds.push(feedId);
}

async function get(db, id) {
    return await db.get(Store, id);
}

// return a feed object if url is ok, or throw
async function sanitize(url) {
    let feed = new Object();
    let response = await fetch(url);
    let mime = response.headers.get('Content-Type');
    let parts = mime.split(/\s*;\s*/);
    mime = parts[0];
    feed.feedUrl = url;
    feed.lastLoadTime = 0;
    switch (mime) {
    case "application/json":
    case "application/feed+json";
	feed.type = FeedType.json;
	break;
    case "application/atom+xml":
	feed.type = FeedType.atom;
	break;
    case "application/rss+xml":
    case "application/x-rss+xml":
    case "application/xml":
	feed.type = FeedType.rss2;
	break;
    default:
	throw("Unrecognized mime");
    }
    return feed;
}

async function addFeed(db, feed) {
    await db.put(Store, feed);
    // id is auto gen from put. New feed is insert at the beginning to be load
    feeds = [feed.id, ...feeds];
}

async function removeFeed(db, id) {
    feeds = feeds.filter(i => i != id);
    await db.delete(Store, id);
}
