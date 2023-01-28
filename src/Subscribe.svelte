<script>
 export let clickCancel;

 import {subscribe} from  './airss_controller.js';

 let subscribeUrl = "";

 function clickSubmitSubscribe() {
     subscribe(subscribeUrl);
     clickCancel();
 }
</script>

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
