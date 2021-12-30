/*
 * The items schema, based on jsonfeed
 */
import * as Airtable from './airtable_server.js';
import * as Feeds from './feeds.js';

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
	markRead, getCurrentItem, deleteCurrentItem, deleteAllItemsOfFeed,
	allUrlsOfFeed, pushItem, addItem};

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

async function deleteAllItemsOfFeed(db, feedId) {
    let after = [];
    let above_reading = false;
    let above_known = false;
    let reading_shrink = 0;
    let known_shrink = 0;
    for (let i = 0; i < items.length; i++) {
	let id = items[i];
	let item = await db.get(Store, id);
	if (item.feedId == feedId) {
	    await db.delete(Store, id);
	    // we do not await it and just hope it will land
	    Airtable.deleteItem(id);
	    if (!above_reading)
		reading_shrink++;
	    if (!above_known)
		known_shrink++;
	} else {
	    after.push(id);
	}
	if (i == reading)
	    above_reading = true;
	if (i == known)
	    above_known = true;
    }
    items = [...after];
    reading = reading - reading_shrink;
    known = known - known_shrink;
}

async function allUrlsOfFeed(db, feedId) {
    let list = [];
    for (let i = 0; i < items.length; i++) {
	let id = items[i];
	let item = await db.get(Store, id);
	if (item.feedId == feedId) {
	    list.push(item.url);
	}
    }
    return list;
}

async function pushItem(db, item) {
    let id = await db.add(Store, item);
    if (!isDummyItem(item))
	Feeds.addDate(item.feedId, item.datePublished);
    items.push(id);
    item.id = id;
    // we do not await it and just hope it will land
    Airtable.addItem(item);
    return id;
}

async function addItem(db, item) {
    // may throw
    await db.add(Store, item);
    if (!isDummyItem(item))
	Feeds.addDate(item.feedId, item.datePublished);
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

function isDummyItem(item) {
    let tags = item.tags;
    return tags.length == 1 && tags[0] == "_error";
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
	    if (!isDummyItem(cursor.value))
		Feeds.addDate(feedId, cursor.value.datePublished);
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
