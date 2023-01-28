<script>
 export let clickCancel;

 // functions
 import {clearData, saveFeeds, restoreFeeds, postHandle} from  './airss_controller.js';

 let waterMark = parseInt(localStorage.getItem("WATER_MARK")) || 1;
 let waterMarkChoices = [
     {value: 1, text: "1 item"},
     {value: 10, text: "10 items"},
     {value: 100, text: "100 items"},
     {value: 1000, text: "1000 items"}
 ];

 let minReloadWait = parseInt(localStorage.getItem("MIN_RELOAD_WAIT")) || 12;
 let minReloadWaitChoices = [
     {value: 1, text: "1 hour"},
     {value: 4, text: "4 hours"},
     {value: 12, text: "12 hours"},
     {value: 24, text: "24 hours"}
 ];

 let maxKeptPeriod = parseInt(localStorage.getItem("MAX_KEPT_PERIOD")) || 180;
 let maxKeptPeriodChoices = [
     {value: 30, text: "30 days"},
     {value: 60, text: "60 days"},
     {value: 180, text: "180 days"},
     {value: 999, text: "999 days"}
 ];

 let maxItemsPerFeed = parseInt(localStorage.getItem("MAX_ITEMS_PER_FEED")) || 100;
 let maxItemsPerFeedChoices = [
     {value: 25, text: "25 items"},
     {value: 50, text: "50 items"},
     {value: 100, text: "100 items"},
     {value: 200, text: "200 items"}
 ];

 let truncateItemsPerFeed = parseInt(localStorage.getItem("TRUNCATE_ITEMS_PER_FEED")) || 25;
 let truncateItemsPerFeedChoices = [
     {value: 1, text: "1 item"},
     {value: 10, text: "10 items"},
     {value: 25, text: "25 items"},
     {value: 100, text: "100 items"}
 ];

 let bounceLoad = localStorage.getItem("BOUNCE_LOAD") != "false";

 let clearDatabase = "";

 let restoreHandle = "";

 function clickSubmitConfig() {
     // airss_model:
     localStorage.setItem("WATER_MARK", waterMark);
     localStorage.setItem("MIN_RELOAD_WAIT", minReloadWait);
     localStorage.setItem("MAX_KEPT_PERIOD", maxKeptPeriod);
     localStorage.setItem("MAX_ITEMS_PER_FEED", maxItemsPerFeed);
     localStorage.setItem("TRUNCATE_ITEMS_PER_FEED", truncateItemsPerFeed);
     localStorage.setItem("BOUNCE_LOAD", bounceLoad);
     // It is very hard to change config at run time, so I just take
     // shortcut to reload
     if (clearDatabase == "clear database") {
	 clearData().then(() => {
	     location.reload();
	 });
     } else {
	 location.reload();
     }
 }

 function clickSaveFeeds(e) {
     saveFeeds();
 }

 function clickRestoreFeeds(e) {
     restoreFeeds(restoreHandle);
 }
</script>

<form on:submit|preventDefault={clickSubmitConfig}>
    <section class="pt-2 border-b
		    lg:flex lg:flex-row lg:flex-wrap lg:gap-x-4 lg:justify-center">
	<div class="field long">
	    <label for="select-water-mark">
		Load more when unread items is below:
	    </label>
	    <select id="select-water-mark" bind:value={waterMark}>
		{#each waterMarkChoices as choice}
		    <option value={choice.value}>{choice.text}</option>
		{/each}
	    </select>
	</div>
	<div class="field long">
	    <label for="select-min-reload-wait">
		Between reloading a feed, wait at least:
	    </label>
	    <select id="select-min-reload-wait" bind:value={minReloadWait}>
		{#each minReloadWaitChoices as choice}
		    <option value={choice.value}>{choice.text}</option>
		{/each}
	    </select>
	</div>
	<div class="field long">
	    <label for="select-max-kept-period">
		Keep read items in the database for:
	    </label>
	    <select id="select-max-kept-period" bind:value={maxKeptPeriod}>
		{#each maxKeptPeriodChoices as choice}
		    <option value={choice.value}>{choice.text}</option>
		{/each}
	    </select>
	</div>
	<div class="field long">
	    <label for="select-max-items-per-feed">
		Keep in the database at most per feed:
	    </label>
	    <select id="select-max-items-per-feed" bind:value={maxItemsPerFeed}>
		{#each maxItemsPerFeedChoices as choice}
		    <option value={choice.value}>{choice.text}</option>
		{/each}
	    </select>
	</div>
	<div class="field long">
	    <label for="select-truncate-items-per-feed">
		Truncate each feed while loading to at most:
	    </label>
	    <select id="select-truncate-items-per-feed" bind:value={truncateItemsPerFeed}>
		{#each truncateItemsPerFeedChoices as choice}
		    <option value={choice.value}>{choice.text}</option>
		{/each}
	    </select>
	</div>
	<div class="field long">
	    <label for="input-bounce-load">
		Load feeds with roastidio.us (<a href="https://github.com/derek-zhou/airss#Proxy">Why</a>):
	    </label>
	    <input id="input-bounce-load" type="checkbox" bind:checked={bounceLoad}>
	</div>
    </section>
    {#if bounceLoad}
	<section>
	    <div class="field">
		<button class="button text-button" on:click|preventDefault={clickSaveFeeds}>Save Feeds</button>
		{#if $postHandle}
		    <label class="code">{$postHandle}</label>
		{:else}
		    <label class="code">Not Saved</label>
		{/if}
	    </div>
	</section>
	<section>
	    <div class="field">
		<button class="button text-button" on:click|preventDefault={clickRestoreFeeds}>
		    Restore Feeds</button>
		<input id="input-restore-handle" type="text" class="short code"
		       bind:value={restoreHandle}>
	    </div>
	</section>
    {/if}
    <section>
	<div class="field alert alert-danger">
	    <label for="input-clear-database">Danger! Type "clear database" to delete all data</label>
	    <input id="input-clear-database" type="text" bind:value={clearDatabase}>
	</div>
    </section>
    <div class="toolbar">
	<input class="button" type="submit" value="👌">
	<input class="button" type="reset" value="👎"
	       on:click={clickCancel}>
    </div>
</form>
