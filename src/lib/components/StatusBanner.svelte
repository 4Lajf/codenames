<script lang="ts">
  import { cn } from "$lib/utils";
  
  let { message, type = 'info' }: { message: string; type?: 'info' | 'red' | 'blue' | 'warning' } = $props();
</script>

<div 
  class={cn(
    "text-xs sm:text-sm md:text-base lg:text-lg py-1.5 sm:py-2 px-3 sm:px-5 md:px-8 shadow-lg border-2 rounded-full font-bold transition-all duration-300 pointer-events-none inline-flex items-center justify-center text-center whitespace-nowrap",
    type === 'red' && "bg-red-100 text-red-800 border-red-500",
    type === 'blue' && "bg-blue-100 text-blue-800 border-blue-500",
    type === 'warning' && "bg-orange-100 text-orange-800 border-orange-500",
    type === 'info' && "bg-white text-gray-800 border-gray-200"
  )}
>
  {message}
</div>
