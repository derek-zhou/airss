/*
 * The items schema, based on jsonfeed
 */
import * as Feeds from './feeds.js';
import {openCursor, openCursorFromIndex, continueCursor, getObject, getObjectFromIndex,
	addObject, putObject, deleteObject} from './index_db.js';

const Store = "items";
const UrlIndex = "url";

// in memory state
// items is an array of item ids in ascending order
var items;
// pointer to the current reading position
var reading;
var readCount;

// public apis
export {upgrade, load, length, readingCursor, forward, backward, unreadCount, getCurrentItem,
	getItem, deleteCurrentItem, deleteAllItemsOfFeed, allUrlsOfFeed, pushItem, updateItem,
	isDummyItem, isCurrentItem};

function readingCursor() {
    return reading;
}

function unreadCount() {
    return items.length - readCount;
}

async function updateReadCount(db) {
    if (reading >= 0) {
	let item = await getObject(db, Store, items[reading]);
	if (item && !item.read) {
	    item.read = true;
	    await putObject(db, Store, item);
	    readCount ++;
	}
    }
}

async function forward(db) {
    await updateReadCount(db);
    if (reading >= items.length - 1)
	return false;
    reading ++;
    return true;
}

async function backward(db) {
    await updateReadCount(db);
    if (reading <= 0)
	return false;
    reading --;
    return true;
}

function length() {
    return items.length;
}

function getCurrentItem(db) {
    if (reading >= 0)
	return getObject(db, Store, items[reading]);
    else
	return null;
}

function getItem(db, id) {
    return getObject(db, Store, id);
}

async function deleteCurrentItem(db) {
    if (reading < 0)
	return false;
    let item = await getObject(db, Store, items[reading]);
    if (!item)
	return false;
    if (item.read) {
	readCount --;
    }
    Feeds.removeItem(item.feedId, items[reading]);
    await deleteObject(db, Store, items[reading]);
    items = items.slice(0, reading).concat(items.slice(reading + 1));
    if (reading == items.length) {
	reading --;
    }
    return true;
}

async function deleteAllItemsOfFeed(db, feedId) {
    let after = [];
    let above_reading = false;
    let reading_shrink = 0;
    let itemSet = Feeds.itemsOf(feedId);
    for (let i = 0; i < items.length; i++) {
	let id = items[i];
	if (itemSet.has(id)) {
	    if (!above_reading)
		reading_shrink ++;
	    let item = await getObject(db, Store, id);
	    if (item && item.read) {
		readCount --;
	    }
	    await deleteObject(db, Store, id);
	} else {
	    after.push(id);
	}
	if (i == reading)
	    above_reading = true;
    }
    items = [...after];
    reading = reading - reading_shrink;
    if (reading == items.length) {
	reading --;
    }
}

async function allUrlsOfFeed(db, feedId) {
    let list = [];
    let itemSet = Feeds.itemsOf(feedId);
    for (let id of itemSet.values()) {
	let item = await getObject(db, Store, id);
	if (item && !isDummyItem(item))
	    list.push(item.url);
    }
    return list;
}

async function pushItem(db, item) {
    let id = await addObject(db, Store, item);
    Feeds.addItem(item.feedId, id);
    items.push(id);
    item.id = id;
    if (reading < 0) {
	reading = 0;
    }
    return id;
}

function updateItem(db, item) {
    return putObject(db, Store, item);
}

function upgrade(db) {
    // the store holds all the feeds
    let store = db.createObjectStore(
	Store, {keyPath: "id", autoIncrement: true});
    store.createIndex(UrlIndex, UrlIndex, {unique: true});
}

function isDummyItem(item) {
    let tags = item.tags;
    return tags.length == 1 && tags[0] == "_error";
}

function isCurrentItem(item) {
    return item.id == items[reading];
}

async function load(db) {
    let cursor = await openCursor(db, Store, IDBKeyRange.lowerBound(0), "prev");
    let perFeedCounter = new Map();
    let buffer = [];
    let unread = 0;
    let counter = 0;
    let expired = [];
    let now = new Date();
    let maxKeptPeriod = parseInt(localStorage.getItem("MAX_KEPT_PERIOD")) || 180;
    let maxKeptItems = parseInt(localStorage.getItem("MAX_ITEMS_PER_FEED")) || 100;
    readCount = 0;

    while (cursor) {
	let feedId = cursor.value.feedId;
	let thisCount = 0;
	if (perFeedCounter.has(feedId))
	    thisCount = perFeedCounter.get(feedId);
 	if (now - cursor.value.datePublished < maxKeptPeriod*24*3600*1000 &&
	    thisCount < maxKeptItems) {
	    buffer.push(cursor.key);
	    counter ++;
	    perFeedCounter.set(feedId, thisCount + 1);
	    Feeds.addItem(feedId, cursor.value.id);
	    // items from the beginning up to a point are read
	    if (cursor.value.read) {
		readCount ++;
	    } else {
		unread = counter;
	    }
	} else {
	    expired.push(cursor.key);
	}
	cursor = await continueCursor(cursor);
    }

    for (let id of expired.values()) {
	console.info("deleteing expired item: " + id);
	await deleteObject(db, Store, id);
    }
    items = buffer.reverse();
    if (unread == 0) {
	reading = counter - 1;
    } else {
	reading = counter - unread;
    }
    // return a copy so my state is not affected
    return [...items];
}
