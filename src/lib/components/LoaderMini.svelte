<script lang="ts">
  let { size = 16, class: cls = "" }: { size?: number; class?: string } = $props();
</script>

<span class="loader {cls}" style="--s:{size}px" role="presentation"></span>

<style>
  .loader {
    display: inline-block;
    flex: none;
    width: var(--s);
    height: var(--s);
    border-radius: 999px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    opacity: 0.8;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(1turn);
    }
  }
</style>
