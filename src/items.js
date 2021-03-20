/*
 * The items schema, based on jsonfeed
 */
import * as Airtable from './airtable_server.js';

const Store = "items";

// kept in days
const MaxKeptPeriod = localStorage.getItem("MAX_KEPT_PERIOD") || 180;

// items is an array of item ids in ascending order
let items = [];
let reading = -1;
let known = -1;

// public apis
export {upgrade, load, length,
	readingCursor, knownCursor, forwardCursor, backwardCursor, unreadCount,
	markRead, getCurrentItem, deleteCurrentItem, pushItem};

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
    // it may throw, which will be catch outside
    let id = await db.add(Store, item);
    items.push(id);
    items.id = id;
     // we do not await it and just hope it will land
    Airtable.addItem(item);
}

function upgrade(db) {
    // the store holds all the feeds
    let store = db.createObjectStore(
	Store, {keyPath: "id", autoIncrement: true});
    store.createIndex("url", "url", {unique: true});
}

async function load(db) {
    let store = await db.transaction(Store).store;
    let cursor = await store.openCursor();
    let lastId = 0;

    items = [];
    known = -1;
    let expired = [];
    let now = new Date();
    while (cursor) {
	if (lastId < cursor.value.id)
	    lastId = cursor.value.id;
	if (now - cursor.value.datePublished <= MaxKeptPeriod*24*3600*1000) {
	    items.push(cursor.key);
	    // items from the beginning up to a point are read
	    if (cursor.value.read)
		known ++;
	} else {
	    expired.push(cursor.key);
	}
	cursor = await cursor.continue();
    }

    let missingItems;
    do {
	missingItems = await Airtable.loadItemsBeyond(lastId);
	for (let item of missingItems.values()) {
	    if (lastId < item.id)
		lastId = item.id;
	    await db.add(Store, item);
	    items.push(item.id);
	    if (item.read)
		known ++;
	}
    } while(missingItems.length > 0);

    for (let id of expired.values()) {
	console.info("deleteing expired item: " + id);
	await db.delete(Store, id);
	// we do not await it and just hope it will land
	Airtable.deleteItem(id);
    }

    // point both cursor at the last read item
    reading = known;
}
