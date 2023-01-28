<script>
 export let item;
 export let shouldUnsubscribe;
 export let clickCancel;

 import {deleteItem, unsubscribe} from  './airss_controller.js';

 function clickConfirmDelete() {
     if (shouldUnsubscribe)
	 unsubscribe(item.feedId);
     else
	 deleteItem();
     clickCancel();
 }
</script>

<form on:submit|preventDefault={clickConfirmDelete}>
    <p>
	Are you sure you want to delete this item?
    </p>
    <div class="field">
	<label for="check-unsubscribe">
	    Unsubscribe <span class="focus">{item.feedTitle}</span> too
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
