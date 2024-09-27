import { Form, routeAction$ } from "@qwikdev/city";
import { component$, useSignal } from "@qwikdev/core";

export const useAction = routeAction$(() => true);
export default component$((props) => {
  const signal = useSignal(false);
  return (
    <section>
      <Form spaReset={signal.value}>
        <button
          type="button"
          id="issue-4679-button"
          onClick$={() => {
            signal.value = !signal.value;
          }}
        >
          Toggle {}
          {signal.value ? <span>True</span> : <span>False</span>}
        </button>
      </Form>
    </section>
  );
});
