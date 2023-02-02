import { Show, For } from "solid-js";
import {clearData, saveFeeds, restoreFeeds, Screens, setScreen,
	postHandle} from  './airss_controller.js';

let waterMark;
const waterMarkDefault = parseInt(localStorage.getItem("WATER_MARK")) || 1;
const waterMarkChoices = [
    {value: 1, text: "1 item"},
    {value: 10, text: "10 items"},
    {value: 100, text: "100 items"},
    {value: 1000, text: "1000 items"}
];

let mnReloadWait;
const minReloadWaitDefault = parseInt(localStorage.getItem("MIN_RELOAD_WAIT")) || 12;
const minReloadWaitChoices = [
    {value: 1, text: "1 hour"},
    {value: 4, text: "4 hours"},
    {value: 12, text: "12 hours"},
    {value: 24, text: "24 hours"}
];

let maxKeptPeriod;
let maxKeptPeriodDefault = parseInt(localStorage.getItem("MAX_KEPT_PERIOD")) || 180;
let maxKeptPeriodChoices = [
    {value: 30, text: "30 days"},
    {value: 60, text: "60 days"},
    {value: 180, text: "180 days"},
    {value: 999, text: "999 days"}
];

let maxItemsPerFeed;
let maxItemsPerFeedDefault = parseInt(localStorage.getItem("MAX_ITEMS_PER_FEED")) || 100;
let maxItemsPerFeedChoices = [
    {value: 25, text: "25 items"},
    {value: 50, text: "50 items"},
    {value: 100, text: "100 items"},
    {value: 200, text: "200 items"}
];

let truncateItemsPerFeed;
let truncateItemsPerFeedDefault = parseInt(localStorage.getItem("TRUNCATE_ITEMS_PER_FEED")) || 25;
let truncateItemsPerFeedChoices = [
    {value: 1, text: "1 item"},
    {value: 10, text: "10 items"},
    {value: 25, text: "25 items"},
    {value: 100, text: "100 items"}
];

let bounceLoad;
let bounceLoadDefault = localStorage.getItem("BOUNCE_LOAD") != "false";

let clearDatabase;
let clearDatabaseDefault = "";

let restoreHandle;
let restoreHandleDefault = "";

function clickSubmitConfig(e) {
    // airss_model:
    localStorage.setItem("WATER_MARK", waterMark.value);
    localStorage.setItem("MIN_RELOAD_WAIT", minReloadWait.value);
    localStorage.setItem("MAX_KEPT_PERIOD", maxKeptPeriod.value);
    localStorage.setItem("MAX_ITEMS_PER_FEED", maxItemsPerFeed.value);
    localStorage.setItem("TRUNCATE_ITEMS_PER_FEED", truncateItemsPerFeed.value);
    localStorage.setItem("BOUNCE_LOAD", bounceLoad.value);
    // It is very hard to change config at run time, so I just take
    // shortcut to reload
    if (clearDatabase.value == "clear database") {
	clearData().then(() => {
	    location.reload();
	});
    } else {
	location.reload();
    }
    e.preventDefault();
}

function clickCancel(e) {
    setScreen(Screens.browse);
    e.preventDefault();
}

function clickSaveFeeds(e) {
    saveFeeds();
    e.preventDefault();
}

function clickRestoreFeeds(e) {
    restoreFeeds(restoreHandle.value);
    e.preventDefault();
}

export default function Config() {
    return (
<form onSubmit={clickSubmitConfig}>
  <section class="pt-2 border-b
		  lg:flex lg:flex-row lg:flex-wrap lg:gap-x-4 lg:justify-center">
    <div class="field long">
      <label for="select-water-mark">
	Load more when unread items is below:
      </label>
      <select id="select-water-mark" ref={waterMark}>
	<For each={waterMarkChoices}>{(choice) =>
	  <option selected={choice.value == waterMarkDefault}
		  value={choice.value}>{choice.text}</option>
	  }</For>
      </select>
    </div>
    <div class="field long">
      <label for="select-min-reload-wait">
	Between reloading a feed, wait at least:
      </label>
      <select id="select-min-reload-wait" ref={minReloadWait}>
	<For each={minReloadWaitChoices}>{(choice) =>
	  <option selected={choice.value == minReloadDefault}
		  value={choice.value}>{choice.text}</option>
	  }</For>
      </select>
    </div>
    <div class="field long">
      <label for="select-max-kept-period">
	Keep read items in the database for:
      </label>
      <select id="select-max-kept-period" ref={maxKeptPeriod}>
	<For each={maxKeptPeriodChoices}>{(choice) =>
	  <option selected={choice.value == maxKeptPeriodDefault}
		  value={choice.value}>{choice.text}</option>
	  }</For>
      </select>
    </div>
    <div class="field long">
      <label for="select-max-items-per-feed">
	Keep in the database at most per feed:
      </label>
      <select id="select-max-items-per-feed" ref={maxItemsPerFeed}>
	<For each={maxItemsPerFeedChoices}>{(choice) =>
	  <option selected={choice.value == maxItemsPerFeedDefault}
		  value={choice.value}>{choice.text}</option>
	  }</For>
      </select>
    </div>
    <div class="field long">
      <label for="select-truncate-items-per-feed">
	Truncate each feed while loading to at most:
      </label>
      <select id="select-truncate-items-per-feed" ref={truncateItemsPerFeed}>
	<For each={truncateItemsPerFeedChoices}>{(choice) =>
	  <option selected={choice.value == truncateItemsPerFeedDefault}
		  value={choice.value}>{choice.text}</option>
	  }</For>
      </select>
    </div>
    <div class="field long">
      <label for="input-bounce-load">
	Load feeds with roastidio.us (<a href="https://github.com/derek-zhou/airss#Proxy">Why</a>):
      </label>
      <input id="input-bounce-load" type="checkbox"
	     ref={bounceLoad} value={bounceLoadDefault} />
    </div>
  </section>
  <Show when={bounceLoadDefault}>
    <section>
      <div class="field">
	<button class="button text-button" onClick={clickSaveFeeds}>Save Feeds</button>
	<Show when={postHandle()}>
	      <label class="code">{postHandle()}</label>
	</Show>
	<Show when={!postHandle()}>
	      <label class="code">Not Saved</label>
	</Show>
      </div>
    </section>
    <section>
      <div class="field">
	<button class="button text-button" onClick={clickRestoreFeeds}>Restore Feeds</button>
	<input id="input-restore-handle" type="text" class="short code"
	       ref={restoreHandle} value={restoreHandleDefult} />
      </div>
    </section>
  </Show>
  <section>
    <div class="field alert alert-danger">
      <label for="input-clear-database">Danger! Type "clear database" to delete all data</label>
      <input id="input-clear-database" type="text" ref={clearDatabase} />
    </div>
  </section>
  <div class="toolbar">
    <input class="button" type="submit" value="👌" />
    <input class="button" type="reset" value="👎" onClick={clickCancel} />
  </div>
</form>
    );
}
