// Expect error: { "messageId": "referencesOutside" }
import { component$, useTask$ } from '@qwikdev/core';

export const HelloWorld = component$(() => {
  function useMethod() {
    // eslint-disable-next-line no-console
    console.log('stuff');
  }
  useTask$(() => {
    // eslint-disable-next-line no-console
    console.log(useMethod);
  });
  return <div></div>;
});
