import { component$ } from '@qwikdev/core';

export default component$(() => {
  return (
    <a href="/" onClick$={() => alert('do something else.')}>
      click me!
    </a>
  );
});
