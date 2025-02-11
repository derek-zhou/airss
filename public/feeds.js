/*
 * The feeds schema, based on jsonfeed
 */
const Store = "feeds";
const UrlIndex = "feedUrl";
const TimeIndex = "lastLoadTime";

import {openCursor, openCursorFromIndex, continueCursor, getObject, getObjectFromIndex,
	addObject, putObject, deleteObject} from './index_db.js';

// in memory state
// feeds is an array of feed ids, in the order of last load time. feeds[0]
// is the oldest
var feeds;

// all items of a feed in a Map
var itemSet;

// public apis
export {upgrade, load, get, first, rotate, addFeed, updateFeed, allFeedUrls,
	removeFeed, deleteFeed, getFeed, addItem, removeItem, itemsOf};

function upgrade(db) {
    // the store holds all the feeds
    let store = db.createObjectStore(
	Store, {keyPath: "id", autoIncrement: true});
    store.createIndex(UrlIndex, UrlIndex, {unique: true});
    store.createIndex(TimeIndex, TimeIndex, {unique: false});
}

async function load(db) {
    let cursor = await openCursorFromIndex(db, Store, TimeIndex);

    feeds = [];
    itemSet = new Map();
    while (cursor) {
	feeds.push(cursor.value.id);
	cursor = await continueCursor(cursor);
    }
    // return a copy so my state is not affected
    return [...feeds];
}

function first() {
    if (feeds.lenth == 0)
	return null;
    return feeds[0];
}

function rotate() {
    feeds = [...feeds.slice(1), feeds[0]];
}

async function allFeedUrls(db) {
    let urls = [];
    for (let id of feeds.values()) {
	let feed = await getObject(db, Store, id);
	urls.push(feed.feedUrl);
    }
    return urls;
}

async function get(db, id) {
    let feed = await getObject(db, Store, id);
    // patch the database if this field is missing
    if (!feed.lastFetchTime)
	feed.lastFetchTime = feed.lastLoadTime;
    return feed;
}

async function getFeed(db, url) {
    let feed = await getObjectFromIndex(db, Store, UrlIndex, url);
    if (feed)
	return feed.id;
    else
	return null;
}

async function addFeed(db, feed) {
    if (feed.id) {
	feeds.push(feed.id);
	await addObject(db, Store, feed);
	return feed.id;
    } else {
	let id = await addObject(db, Store, feed);
	feeds.push(id);
	feed.id = id;
	return id;
    }
}

function updateFeed(db, feed) {
    return putObject(db, Store, feed);
}

function removeFeed(db, id) {
    itemSet.delete(id);
    return deleteFeed(db, id);
}

function deleteFeed(db, id) {
    feeds = feeds.filter(i => i != id);
    return deleteObject(db, Store, id);
}

function addItem(id, item_id) {
    if (itemSet.has(id))
	itemSet.get(id).add(item_id);
    else
	itemSet.set(id, new Set([item_id]));
}

function removeItem(id, item_id) {
    if (itemSet.has(id))
	itemSet.get(id).delete(item_id);
}

function itemsOf(id) {
    if (itemSet.has(id))
	return itemSet.get(id);
    else
	return new Set();
}
