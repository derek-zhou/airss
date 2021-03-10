/*
 * The items schema, based on jsonfeed
 */

const SampleItem = {
    id: 0,
    read: false,
    feedTitle: "",
    feedId: 0,
    datePublished: null,
    contentHtml: "",
    url: "",
    imageUrl: "",
    title: "",
    tags: [],
    authors: []
};

export const Store = "items";

// items is an array of item ids in ascending order
let items = [];
let readingCursor = -1;
let knownCursor = -1;

// public apis
export {upgrade, load, length, markRead,
	readingCursor, knownCursor, forwardCursor, backwardCursor, unreadCount,
	markRead, getCurrentItem, pushItem,
	parseJSONItem};

function parseJSONItem(json) {
    let item = new Object();
    item.datePublished = new Date(json.date_published);
    if (json.content_html !== undefined)
	item.contentHtml = json.content_html;
    else if (json.content_text !== undefined)
	item.contentHtml = '<pre>' + json.content_text + '</pre>';
    else
	throw "Malformed JSON";
    item.url = json.url;
    item.imageUrl = json.image_url;
    item.title = json.title;
    item.tags = json.tags;
    item.authors = json.authors;
}

function readingCursor() {
    return readingCursor;
}

function knownCursor() {
    return knownCursor;
}

function unreadCount() {
    return items.length() - knownCursor - 1;
}

function forwardCursor() {
    if (readingCursor >= items.length() - 1)
	return false;
    readingCursor ++;
    if (knownCursor < readingCursor)
	knownCursor = readingCursor;
    return true;
}

function backwardCursor() {
    if (readingCursor <= 0)
	return false;
    readingCursor --;
}

function length() {
    return items.length();
}

async function markRead(db, item) {
    if (item.read)
	return;
    item.read = true;
    await db.put(Store, item);
}

function getCurrentItem(db) {
    return db.get(Store, items[readingCursor]);
}

async function pushItem(db, item) {
    // it may throw, which will be catch outside
    await db.put(Store, item);
    // the id is auto-generated
    items.push(item.id);
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

    items = [];
    knownCursor = -1;
    while (cursor) {
	// items from the beginning up to a point are read
	if (cursor.value.read)
	    knownCursor ++;
	items.push(cursor.key);
	cursor = await cursor.continue();
    }
    // point both cursor at the last read item
    readingCursor = knownCursor;
}
