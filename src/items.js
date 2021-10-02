/*
 * The items schema, based on jsonfeed
 */
import * as Airtable from './airtable_server.js';

const Store = "items";

// kept in days
const MaxKeptPeriod = localStorage.getItem("MAX_KEPT_PERIOD") || 180;
// keep at most 100 items from feed
const MaxKeptItems = localStorage.getItem("MAX_ITEMS_PER_FEED") || 100;

// items is an array of item ids in ascending order
let items = [];
let reading = -1;
let known = -1;

// public apis
export {upgrade, load, length,
	readingCursor, knownCursor, forwardCursor, backwardCursor, unreadCount,
	markRead, getCurrentItem, deleteCurrentItem, pushItem, addItem};

function readingCursor() {
    return reading;
}

function knownCursor() {
    return known;
}

function unreadCount() {
    return items.length - known - 1;
}

function forwardCursor() {
    if (reading >= items.length - 1)
	return false;
    reading ++;
    if (known < reading)
	known = reading;
    return true;
}

function backwardCursor() {
    if (reading <= 0)
	return false;
    reading --;
    return true;
}

function length() {
    return items.length;
}

function markRead(db, item) {
    if (item.read)
	return;
    item.read = true;
     // we do not await it and just hope it will land
    Airtable.markRead(item.id);
    return db.put(Store, item);
}

function getCurrentItem(db) {
    if (reading >= 0)
	return db.get(Store, items[reading]);
    else
	return null;
}

async function deleteCurrentItem(db) {
    if (reading < 0)
	return false;
    await db.delete(Store, items[reading]);
     // we do not await it and just hope it will land
    Airtable.deleteItem(items[reading]);
    items = items.slice(0, reading).concat(items.slice(reading + 1));
    reading--;
    known--;
    return true;
}

async function pushItem(db, item) {
    let id = await db.add(Store, item);
    items.push(id);
    item.id = id;
    // we do not await it and just hope it will land
    Airtable.addItem(item);
    return id;
}

async function addItem(db, item) {
    // may throw
    await db.add(Store, item);
    // already has id, must comming from airtable
    items.push(item.id);
    if (item.read && known == items.length - 2)
	known ++;
}

function upgrade(db) {
    // the store holds all the feeds
    let store = db.createObjectStore(
	Store, {keyPath: "id", autoIncrement: true});
    store.createIndex("url", "url", {unique: true});
}

async function load(db) {
    let store = await db.transaction(Store).store;
    let cursor = await store.openCursor(IDBKeyRange.lowerBound(0), "prev");
    let perFeedCounter = new Map();
    let buffer = [];
    let unread = 0;
    let counter = 0;
    let expired = [];
    let now = new Date();

    while (cursor) {
	let feedId = cursor.value.feedId;
	let thisCount = 0;
	if (perFeedCounter.has(feedId))
	    thisCount = perFeedCounter.get(feedId);
 	if (now - cursor.value.datePublished <= MaxKeptPeriod*24*3600*1000 &&
	    thisCount <= MaxKeptItems) {
	    buffer.push(cursor.key);
	    counter ++;
	    perFeedCounter.set(feedId, thisCount + 1);
	    // items from the beginning up to a point are read
	    if (!cursor.value.read)
		unread = counter;
	} else {
	    expired.push(cursor.key);
	}
	cursor = await cursor.continue();
    }

    for (let id of expired.values()) {
	console.info("deleteing expired item: " + id);
	await db.delete(Store, id);
	// we do not await it and just hope it will land
	Airtable.deleteItem(id);
    }
    items = buffer.reverse();
    // point both cursor at the last read item
    known = reading = counter - unread - 1;
    // return a copy so my state is not affected
    return [...items];
}
