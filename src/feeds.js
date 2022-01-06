/*
 * The feeds schema, based on jsonfeed
 */
import * as Airtable from './airtable_server.js';

const Store = "feeds";

// in memory state
// feeds is an array of feed ids, in the order of last load time. feeds[0]
// is the oldest
let feeds = [];

// all items of a feed in a Map
let itemSet = new Map();

// public apis
export {upgrade, load, get, first, rotate, addFeed, updateFeed,
	removeFeed, deleteFeed, addItem, removeItem, itemsOf};

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
    // return a copy so my state is not affected
    return [...feeds];
}

function first() {
    if (feeds.lenth == 0)
	return null;
    return feeds[0];
}

function rotate() {
    // throw away the first one. we do not load a feed twice in one session
    feeds = [...feeds.slice(1)];
}

async function get(db, id) {
    return await db.get(Store, id);
}

async function addFeed(db, feed) {
    if (feed.id) {
	// already has id, must comming from airtable
	feeds.push(feed.id);
	await db.add(Store, feed);
	return feed.id;
    } else {
	let id = await db.add(Store, feed);
	feeds.push(id);
	feed.id = id;
	// we do not await it and just hope it will land
	Airtable.insertFeed(feed);
	return id;
    }
}

function updateFeed(db, feed) {
    // we do not await it and just hope it will land
    Airtable.updateFeed(feed);
    return db.put(Store, feed);
}

function removeFeed(db, id) {
    // we do not await it and just hope it will land
    Airtable.deleteFeed(id);
    itemSet.delete(id);
    return deleteFeed(db, id);
}

function deleteFeed(db, id) {
    feeds = feeds.filter(i => i != id);
    return db.delete(Store, id);
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
