/*
 * The feeds schema, based on jsonfeed
 */
import * as Airtable from './airtable_server.js';

const Store = "feeds";

// in memory state
// feeds is an array of feed ids, in the order of last load time. feeds[0]
// is the oldest
let feeds = [];

// public apis
export {upgrade, load, get, first, addFeed, updateFeed, removeFeed};

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
    let lastId = 0;

    feeds = [];
    while (cursor) {
	if (lastId < cursor.value.id)
	    lastId = cursor.value.id;
	feeds.push(lastId);
	cursor = await cursor.continue();
    }
    return lastId;
}

function first() {
    if (feeds.lenth == 0)
	return null;
    let head = feeds[0];
    feeds = feeds.slice(1);
    return head;
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
	Airtable.upsertFeed(feed);
	return id;
    }
}

function updateFeed(db, feed) {
    // we do not await it and just hope it will land
    Airtable.upsertFeed(feed);
    return db.put(Store, feed);
}

function removeFeed(db, id) {
    feeds = feeds.filter(i => i != id);
    // we do not await it and just hope it will land
    Airtable.deleteFeed(id);
    return db.delete(Store, id);
}
