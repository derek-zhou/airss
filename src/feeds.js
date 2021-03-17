/*
 * The feeds schema, based on jsonfeed
 */

export const Store = "feeds";

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
    return feeds.length > 0 ? feeds[0] : null;
}

async function get(db, id) {
    return await db.get(Store, id);
}

async function addFeed(db, feed) {
    let id = await db.add(Store, feed);
    console.log("added feed " + feed.feedUrl + " with id: " + id);
    feeds = [id, ...feeds];
}

async function updateFeed(db, feed) {
    if (feed.id != feeds[0])
	throw "must only update the first feed";
    db.put(Store, feed);
    // rotation
    feeds = [...feeds.slice(1), feed.id];
}

async function removeFeed(db, id) {
    feeds = feeds.filter(i => i != id);
    await db.delete(Store, id);
}
