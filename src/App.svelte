<script>

 // stores
 import {length, cursor, alertText, alertType,
	 currentItem, running, postHandle} from './airss_controller.js';

 // functions
 import {forwardItem, backwardItem, deleteItem, refreshItem, subscribe, unsubscribe,
	 clearData, saveFeeds, restoreFeeds} from  './airss_controller.js';

 import Article from './Article.svelte';

 // constants
 // screen is fundimental content shown in the window
 const Screens = {
     browse: 1,
     shuutdown: 2,
     subscribe: 3,
     trash: 4,
     config: 5
 };
 const roastidious = "https://roastidio.us";
 const roastPrefix = roastidious + "/roast?url=";

 // fundimental states of the app
 let screen = Screens.browse;

 // form value
 let subscribeUrl = "";
 let shouldUnsubscribe = false;

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

 let xDown = null;
 let yDown = null;

 // derived state
 $: leftDisabled = ($cursor <= 0) || (screen != Screens.browse);
 $: rightDisabled = ($cursor >= $length - 1) || (screen != Screens.browse);
 $: screen = !$running ? Screens.shutdown : screen;
 $: alertClass = alertClassFromType($alertType);

 // view functions

 function alertClassFromType(type) {
     switch (type) {
	 case "error":
	     return "alert alert-danger";
	 case "warning":
	     return "alert alert-warning";
	 default:
	     return "alert alert-info";
     }
 }

 function clickLeft() {
     window.scrollTo({top: 0});
     backwardItem();
 }

 function clickRight() {
     window.scrollTo({top: 0});
     forwardItem();
 }

 function browseTouchStart(evt) {
     xDown = evt.touches[0].clientX;
     yDown = evt.touches[0].clientY;
 }

 function browseTouchMove(evt) {
     if ( ! xDown || ! yDown || screen != Screens.browse ) {
         return;
     }
     var xUp = evt.touches[0].clientX;
     var yUp = evt.touches[0].clientY;
     var xDiff = xDown - xUp;
     var yDiff = yDown - yUp;

     /*most significant*/
     if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {
	 if ( xDiff > 0 ) {
	     /* left swipe */
	     clickRight();
	 } else {
	     /* right swipe */
	     clickLeft();
	 }
     }
     /* reset values */
     xDown = null;
     yDown = null;
 }

 function clickReload() {
     location.reload();
 }

 function clearAlert() {
     $alertText = "";
 }

 function clickConfig() {
     clearAlert();
     screen = Screens.config;
 }

 function clickSubscribe() {
     clearAlert();
     screen = Screens.subscribe;
 }

 function clickTrash(e) {
     var button = e.currentTarget;
     clearAlert();
     shouldUnsubscribe = !button.hasAttribute("data-dummy");
     screen = Screens.trash;
 }

 function clickRefresh(e) {
     clearAlert();
     refreshItem();
 }

 function clickConfirmDelete() {
     if (shouldUnsubscribe)
	 unsubscribe($currentItem.feedId);
     else
	 deleteItem();
     screen = Screens.browse;
 }

 function clickSubmitSubscribe() {
     subscribe(subscribeUrl);
     screen = Screens.browse;
 }

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

 function clickCancel() {
     clearAlert();
     screen = Screens.browse;
 }

 function clickSaveFeeds(e) {
     saveFeeds();
 }

 function clickRestoreFeeds(e) {
     restoreFeeds(restoreHandle);
 }

</script>

<svelte:head>
    <title>Airss Reader({$cursor+1}/{$length})</title>
</svelte:head>

<div id="layout" class="relative min-h-screen flex flex-col lg:max-w-screen-lg lg:mx-auto">
    <div class="sticky top-0 bg-gray-100 p-2 flex">
	<div>
	    <a href="/"><img src="/images/airss_logo.png" class="inline-block h-8"></a>
	    <span class="text-gray-600 align-bottom whitespace-nowrap">{$cursor+1}/{$length}</span>
	</div>
      <div class="flex-grow text-right">
	  <button class="button py-1 text-purple-600 inline-block rounded appearance-none
			 font-bold text-lg text-center ml-1 px-1 sm:px-4"
			 on:click={clickConfig}>🔧</button>
	  <button class="button py-1 text-purple-600 inline-block rounded appearance-none
			 font-bold text-lg text-center ml-1 px-1 sm:px-4"
		  on:click={clickSubscribe}>🍼</button>
	  <button class="button py-1 text-purple-600 inline-block rounded appearance-none
			 font-bold text-lg text-center ml-1 px-1 sm:px-4"
		  disabled={leftDisabled}
		  on:click={clickLeft}>◀</button>
	  <button class="button py-1 text-purple-600 inline-block rounded appearance-none
			 font-bold text-lg text-center ml-1 px-1 sm:px-4"
		  disabled={rightDisabled}
		  on:click={clickRight}>▶</button>
      </div>
  </div>
  <p class={alertClass} role="alert" on:click={clearAlert}>{@html $alertText}</p>
  <div class="flex-grow"
      on:touchstart|passive={browseTouchStart}
      on:touchmove|passive={browseTouchMove}>
  {#if screen == Screens.browse}
      <div class="bg-white p-2 flow-root w-full overflow-x-hidden">
	  <Article item={$currentItem} clickTrash={clickTrash} clickRefresh={clickRefresh} />
      </div>
  {:else if screen == Screens.shutdown}
      <button class="button py-1 px-6 inline-block rounded appearance-none font-bold
		     text-lg text-center border-0 text-white bg-purple-600"
	      on:click={clickReload}>Reload</button>
  {:else if screen == Screens.trash}
      <form on:submit|preventDefault={clickConfirmDelete}>
	  <p>
	      Are you sure you want to delete this item?
	  </p>
	  <div class="field">
	      <label for="check-unsubscribe">
		  Unsubscribe <span class="focus">{$currentItem.feedTitle}</span> too
	      </label>
	      <input type="checkbox" id="check-unsubscribe"
		     name="ckeck-unsubscribe"
		     bind:checked={shouldUnsubscribe}>
	  </div>
	  <div class="toolbar">
	      <input class="button" type="submit" value="👌">
	      <input class="button" type="reset" value="👎"
		     on:click={clickCancel}>
	  </div>
      </form>
  {:else if screen == Screens.config}
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
  {:else if screen == Screens.subscribe}
      <form on:submit|preventDefault={clickSubmitSubscribe}>
	  <section>
	      <div class="field long">
		  <label for="input-feed-url">
		      The URL to the feed or the index page:
		  </label>
		  <input id="input-feed-url" type="text" class="long"
			 bind:value={subscribeUrl}
			 placeholder="enter the url to subscribe">
	      </div>
	  </section>
	  <div class="toolbar">
	      <input class="button" type="submit" value="👌">
	      <input class="button" type="reset" value="👎"
		     on:click={clickCancel}>
	  </div>
      </form>
  {/if}
  </div>
  <div class="text-sm text-gray-700 p-2 flex text-center">
      <div class="w-1/2 text-left">
	  <a href="https://roastidio.us/roast" referrerpolicy="no-referrer-when-downgrade">Roast me at Roastidious</a>
      </div>
      <div class="w-1/2 text-right">
	  <a href="https://github.com/derek-zhou/airss" referrerpolicy="no-referrer-when-downgrade">Fork me on GitHub</a>
      </div>
  </div>
</div>
