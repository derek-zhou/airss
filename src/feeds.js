/*
 * The feeds schema, based on jsonfeed
 */

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

    feeds = [];
    while (cursor) {
	feeds.push(cursor.value.id);
	cursor = await cursor.continue();
    }
}

function first() {
    if (feeds.lenth == 0)
	return null;
    let head = feeds[0];
    feeds = feeds.slice(1);
    return head;
}

function rotate() {
}

async function get(db, id) {
    return await db.get(Store, id);
}

async function addFeed(db, feed) {
    let id = await db.add(Store, feed);
    feeds = [id, ...feeds];
    return id;
}

async function updateFeed(db, feed) {
    db.put(Store, feed);
}

async function removeFeed(db, id) {
    feeds = feeds.filter(i => i != id);
    await db.delete(Store, id);
}
