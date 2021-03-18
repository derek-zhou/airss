/*
 * wrap airtable operation in a seperate server.
 */

import Airtable from 'airtable';

export {load};

const ApiKey = localStorage.getItem('AIRTABLE_API_KEY');
const BaseToken = localStorage.getItem('AIRTABLE_BASE_TOKEN');

/*
 * callback states
 */

let base = null;

/*
 * callback functions. I model closely to official API with a promise interface
 */

async function cb_select(prev, table, selector) {
    await prev;
    return await base(table).select(selector).firstPage();
}

async function cb_find(prev, table, key) {
    await prev;
    return await base(table).find(key);
}

async function cb_create(prev, table, fields) {
    await prev;
    return await base(table).create(fields);
}

async function cb_update(prev, table, key, patch) {
    await prev;
    return await base(table).update(key, patch);
}

async function cb_delete(prev, table, key) {
    await prev;
    return await base(table).destroy(key);
}

function init() {
    if (!ApiKey)
	return null;
    
    Airtable.configure({
	endpointUrl: 'https://api.airtable.com',
	apiKey: ApiKey
    });
    try {
	base = Airtable.base('appQhajHA4XMqNfx0');
	return base;
    } catch (e) {
	console.error("Cannot connect to airtable. check your configuration");
	return null;
    }
}

/*
 * client side state
 */

let state = init();

