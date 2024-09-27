import { component$ } from '@qwikdev/core';

export default component$(() => {
  return (
    <main>
      <Greeter />
    </main>
  );
});

export const Greeter = () => {
  return <div>Hello World!</div>;
};
