export function openDB(name, version, upgrade) {
    const request = indexedDB.open(name, version);
    return new Promise((resolve, reject) => {
	request.onerror = () => {
	    reject(request.error);
	};
	request.onsuccess = () => {
	    resolve(request.result);
	};
        request.onupgradeneeded = (event) => {
            upgrade(request.result);
        };
    });
}

export function deleteDB(name) {
    const request = indexedDB.deleteDatabase(name);
    return new Promise((resolve, reject) => {
	request.onerror = () => {
	    reject(request.error);
	};
	request.onsuccess = () => {
	    resolve(request.result);
	};
    });
}

export function openCursor(db, store_name, query, direction) {
    const store = db.transaction(store_name).objectStore(store_name);
    const request = store.openCursor(query, direction);
    return new Promise((resolve, reject) => {
	request.onerror = () => {
	    reject(request.error);
	};
	request.onsuccess = () => {
	    resolve(request.result);
	    request.onsuccess = null;
	};
    });
}

export function openCursorFromIndex(db, store_name, index_name, query, direction) {
    const store = db.transaction(store_name).objectStore(store_name);
    const index = store.index(index_name);
    const request = index.openCursor(query, direction);
    return new Promise((resolve, reject) => {
	request.onerror = () => {
	    reject(request.error);
	};
	request.onsuccess = () => {
	    resolve(request.result);
	    request.onsuccess = null;
	};
    });
}

export function continueCursor(cursor) {
    cursor.continue();
    const request = cursor.request;
    return new Promise((resolve, reject) => {
	request.onerror = () => {
	    reject(request.error);
	};
	request.onsuccess = () => {
	    resolve(request.result);
	    request.onsuccess = null;
	};
    });
}

export function getObject(db, store_name, key) {
    const store = db.transaction(store_name).objectStore(store_name);
    const request = store.get(key);
    return new Promise((resolve, reject) => {
	request.onerror = () => {
	    reject(request.error);
	};
	request.onsuccess = () => {
	    resolve(request.result);
	};
    });
}

export function getObjectFromIndex(db, store_name, index_name, key) {
    const store = db.transaction(store_name).objectStore(store_name);
    const index = store.index(index_name);
    const request = index.get(key);
    return new Promise((resolve, reject) => {
	request.onerror = () => {
	    reject(request.error);
	};
	request.onsuccess = () => {
	    resolve(request.result);
	};
    });
}

export function addObject(db, store_name, object) {
    const store = db.transaction(store_name, "readwrite").objectStore(store_name);
    const request = store.add(object);
    return new Promise((resolve, reject) => {
	request.onerror = () => {
	    reject(request.error);
	};
	request.onsuccess = () => {
	    resolve(request.result);
	};
    });
}

export function putObject(db, store_name, object) {
    const store = db.transaction(store_name, "readwrite").objectStore(store_name);
    const request = store.put(object);
    return new Promise((resolve, reject) => {
	request.onerror = () => {
	    reject(request.error);
	};
	request.onsuccess = () => {
	    resolve(request.result);
	};
    });
}

export function deleteObject(db, store_name, object) {
    const store = db.transaction(store_name, "readwrite").objectStore(store_name);
    const request = store.delete(object);
    return new Promise((resolve, reject) => {
	request.onerror = () => {
	    reject(request.error);
	};
	request.onsuccess = () => {
	    resolve(request.result);
	};
    });
}
