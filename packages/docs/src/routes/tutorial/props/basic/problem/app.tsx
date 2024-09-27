import { component$ } from '@qwikdev/core';

export default component$(() => {
  return (
    <main>
      <Greeter />
    </main>
  );
});

interface GreeterProps {}
export const Greeter = component$((props: GreeterProps) => {
  return <p>Bind props here</p>;
});
