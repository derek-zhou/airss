/*
 * The feeds schema, based on jsonfeed
 */
import * as Airtable from './airtable_server.js';

const Store = "feeds";

// in memory state
// feeds is an array of feed ids, in the order of last load time. feeds[0]
// is the oldest
let feeds = [];

// last datePublished of a feed in a Map
let lastPublished = new Map();

// public apis
export {upgrade, load, get, first, rotate, addFeed, updateFeed, touchFeed,
	removeFeed, deleteFeed, addDate, lastDate};

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
    feeds = [...feeds.slice(1), feeds[0]];
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
	feeds = [id, ...feeds];
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

function touchFeed(db, feed) {
    return db.put(Store, feed);
}

function removeFeed(db, id) {
    // we do not await it and just hope it will land
    Airtable.deleteFeed(id);
    return deleteFeed(db, id);
}

function deleteFeed(db, id) {
    feeds = feeds.filter(i => i != id);
    return db.delete(Store, id);
}

function addDate(id, date) {
    if (lastPublished.has(id)) {
	let last_date = lastPublished.get(id);
	if (last_date < date)
	    lastPublished.set(id, date);
    } else {
	lastPublished.set(id, date);
    }
}

function lastDate(id) {
    if (lastPublished.has(id))
	return lastPublished.get(id);
    else
	return new Date(0);
}
