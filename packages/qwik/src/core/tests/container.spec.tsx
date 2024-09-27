import { walkJSX } from '@qwikdev/core/testing';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ssrCreateContainer } from '../../server/ssr-container';
import { SsrNode } from '../../server/ssr-node';
import { createDocument } from '../../testing/document';
import { getDomContainer } from '../client/dom-container';
import type { ClientContainer, VNode } from '../client/types';
import { vnode_getAttr, vnode_getFirstChild, vnode_getText } from '../client/vnode';
import { SERIALIZABLE_STATE, component$ } from '../shared/component.public';
import { JSXNodeImpl, createPropsProxy } from '../shared/jsx/jsx-runtime';
import { Slot } from '../shared/jsx/slot.public';
import type { JSXOutput } from '../shared/jsx/types/jsx-node';
import { inlinedQrl, qrl } from '../shared/qrl/qrl';
import type { QRLInternal } from '../shared/qrl/qrl-class';
import { SerializationConstant, isDeserializerProxy } from '../shared/shared-serialization';
import { hasClassAttr } from '../shared/utils/scoped-styles';
import { constPropsToSsrAttrs, varPropsToSsrAttrs } from '../ssr/ssr-render-jsx';
import { type SSRContainer } from '../ssr/ssr-types';

describe('serializer v2', () => {
  describe('rendering', () => {
    it('should do basic serialize/deserialize', () => {
      const input = <span>test</span>;
      const output = toVNode(toDOM(toHTML(input)));
      expect(output).toMatchVDOM(input);
    });

    it('should handle multiple text nodes, and fragment', () => {
      const input = (
        <>
          {'Hello'} <b>{'world'}</b>!
        </>
      );
      const output = toVNode(toDOM(toHTML(input)));
      expect(output).toMatchVDOM(input);
    });

    it('should render blog post example', () => {
      const state = { value: 123 };
      const input = (
        <main>
          <>
            <>
              Count: {state.value}!<button>+1</button>
            </>
          </>
        </main>
      );
      const output = toVNode(toDOM(toHTML(input)));
      expect(output).toMatchVDOM(input);
    });

    it('should handle more complex example', () => {
      const input = (
        <div>
          <span>A</span>
          <>Hello {'World'}!</>
          <>
            <span>
              <>B</>!
            </span>
            <>Greetings {'World'}!</>
          </>
        </div>
      );
      const output = toVNode(toDOM(toHTML(input)));
      expect(output).toMatchVDOM(input);
    });

    it('should handle adjacent qwik/vnode data', () => {
      const input = (
        <div>
          <span>A{'B'}</span>
          <span>C{'D'}</span>
        </div>
      );
      const output = toVNode(toDOM(toHTML(input)));
      expect(output).toMatchVDOM(input);
    });

    it('should handle long strings', () => {
      const string = (length: number) => new Array(length).fill('.').join('');
      const input = (
        <div>
          {string(26 * 26 * 26)}
          {string(26 * 26)}
          {string(26)}
        </div>
      );
      const output = toVNode(toDOM(toHTML(input)));
      expect(output).toMatchVDOM(input);
    });

    describe('node references', () => {
      it('should retrieve element', () => {
        const clientContainer = withContainer((ssr) => {
          ssr.openElement('div', ['id', 'parent']);
          ssr.textNode('Hello');
          ssr.openElement('span', ['id', 'myId']);
          const node = ssr.getLastNode();
          ssr.addRoot({ someProp: node });
          ssr.textNode('Hello');
          ssr.openElement('b', ['id', 'child']);
          ssr.closeElement();
          ssr.closeElement();
          ssr.closeElement();
        });
        const vnodeSpan = clientContainer.$getObjectById$(0).someProp;
        expect(vnode_getAttr(vnodeSpan, 'id')).toBe('myId');
      });
      it('should retrieve text node', () => {
        const clientContainer = withContainer((ssr) => {
          ssr.openElement('div', ['id', 'parent']);
          ssr.textNode('Hello');
          ssr.openElement('span', ['id', 'div']);
          ssr.textNode('Greetings');
          ssr.textNode(' ');
          ssr.textNode('World');
          const node = ssr.getLastNode();
          expect(node.id).toBe('2C');
          ssr.textNode('!');
          ssr.addRoot({ someProp: node });
          ssr.openElement('b', ['id', 'child']);
          ssr.closeElement();
          ssr.closeElement();
          ssr.closeElement();
        });
        const vnode = clientContainer.$getObjectById$(0).someProp;
        expect(vnode_getText(vnode)).toBe('World');
      });
      it('should retrieve text node in Fragments', () => {
        const clientContainer = withContainer((ssr) => {
          ssr.openElement('div', ['id', 'parent']);
          ssr.textNode('Hello');
          ssr.openElement('span', ['id', 'div']); // 2
          ssr.textNode('Greetings'); // 2A
          ssr.textNode(' '); // 2B
          ssr.openFragment([]); // 2C
          ssr.textNode('World'); // 2CA
          const node = ssr.getLastNode();
          expect(node.id).toBe('2CA');
          ssr.textNode('!');
          ssr.addRoot({ someProp: node });
          ssr.openElement('b', ['id', 'child']);
          ssr.closeElement();
          ssr.closeFragment();
          ssr.closeElement();
          ssr.closeElement();
        });
        const vnode = clientContainer.$getObjectById$(0).someProp;
        expect(vnode_getText(vnode)).toBe('World');
      });
      it.todo('should attach props to Fragment');
    });
  });

  describe('attributes', () => {
    it('should serialize attributes', () => {
      const input = <span id="test" class="test" />;
      const output = toVNode(toDOM(toHTML(input)));
      expect(output).toMatchVDOM(input);
    });
  });

  describe('object serialization', () => {
    it('should serialize object', () => {
      const container = withContainer((ssrContainer) => {
        const obj = { age: 1, child: { b: 'child' } };
        expect(ssrContainer.addRoot(obj)).toBe(0);
        expect(ssrContainer.addRoot(obj.child)).toBe(1);
      });
      const obj = container.$getObjectById$(0);
      expect(obj).toEqual({ age: 1, child: { b: 'child' } });
      expect(container.$getObjectById$(1)).toBe(obj.child);
    });

    it('should escape string <>', () => {
      const container = withContainer((ssrContainer) => {
        ssrContainer.addRoot({ '</script>': '"<script></script>"', '<': '<script>' });
      });
      expect(container.$getObjectById$(0)).toEqual({
        '</script>': '"<script></script>"',
        '<': '<script>',
      });
    });

    it('should serialize non-standard objects', () => {
      const container = withContainer((ssrContainer) => {
        const obj = { null: null, undefined: undefined };
        expect(ssrContainer.addRoot(null)).toBe(0);
        expect(ssrContainer.addRoot(undefined)).toBe(1);
        expect(ssrContainer.addRoot(obj)).toBe(2);
        expect(
          ssrContainer.addRoot([null, undefined, obj, { null: null, undefined: undefined }])
        ).toBe(3);
      });
      const obj = container.$getObjectById$(2);
      expect(isDeserializerProxy(obj)).toBe(true);
      expect(container.$getObjectById$(0)).toEqual(null);
      expect(container.$getObjectById$(1)).toBe(undefined);
      expect(obj).toEqual({ null: null, undefined: undefined });
      expect(container.$getObjectById$(3)).toEqual([
        null,
        undefined,
        obj,
        { null: null, undefined: undefined },
      ]);
    });

    it('should de-dup long strings', () => {
      const str = new Array(100).fill('a').join('');
      const container = withContainer((ssrContainer) => {
        expect(ssrContainer.addRoot(str)).toBe(0);
        expect(ssrContainer.addRoot({ a: str, b: str })).toBe(1);
      });
      const idx = container.element.innerHTML.indexOf(str);
      expect(idx).toBeGreaterThan(0);
      const idx2 = container.element.innerHTML.indexOf(str, idx + 1);
      expect(idx2).toBe(-1);
      expect(container.$getObjectById$(0)).toEqual(str);
      expect(container.$getObjectById$(1)).toEqual({ a: str, b: str });
    });

    describe('UndefinedSerializer, ///// ' + SerializationConstant.UNDEFINED_CHAR, () => {
      it('should serialize and deserialize', () => {
        const obj = undefined;
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
    });

    describe('ReferenceSerializer, ///// ' + SerializationConstant.REFERENCE_CHAR, () => {
      it.todo('should serialize and deserialize', () => {
        ///
      });
    });

    describe('URLSerializer, /////////// ' + SerializationConstant.URL_CHAR, () => {
      it('should serialize and deserialize', () => {
        const obj = new URL('http://server/path#hash');
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
    });

    describe('DateSerializer, ////////// ' + SerializationConstant.Date_CHAR, () => {
      it('should serialize and deserialize', () => {
        const obj = new Date();
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
    });

    describe('RegexSerializer, ///////// ' + SerializationConstant.Regex_CHAR, () => {
      it('should serialize and deserialize', () => {
        const obj = /abc/gim;
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
    });

    describe('StringSerializer, //////// ' + SerializationConstant.String_CHAR, () => {
      it('should serialize and deserialize', () => {
        const obj = '\u0010anything';
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });

      it('should serialize and deserialize strings in array', () => {
        const obj = ['\b: backspace'];
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
    });

    describe('VNodeSerializer, ///////// ' + SerializationConstant.VNode_CHAR, () => {
      it.todo('should serialize and deserialize', () => {
        ///
      });
    });

    describe('NotFinite, /////////////// ' + SerializationConstant.NotFinite_CHAR, () => {
      it('should serialize and deserialize', () => {
        const obj = Number.NaN;
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
      it('should serialize and deserialize positive', () => {
        const obj = Infinity;
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
      it('should serialize and deserialize negative', () => {
        const obj = -Infinity;
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
    });

    describe('BigIntSerializer, //////// ' + SerializationConstant.BigInt_CHAR, () => {
      it('should serialize and deserialize', () => {
        const obj = BigInt('12345678901234567890');
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
    });

    describe('URLSearchParamsSerializer, ' + SerializationConstant.URLSearchParams_CHAR, () => {
      it('should serialize and deserialize', () => {
        const obj = new URLSearchParams('a=1&b=2');
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
    });

    describe('ErrorSerializer, ///////// ' + SerializationConstant.Error_CHAR, () => {
      it('should serialize and deserialize', () => {
        const obj = Object.assign(new Error('MyError'), { extra: 'property' });
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
    });

    describe('QRLSerializer, /////////// ' + SerializationConstant.QRL_CHAR, () => {
      it('should serialize and deserialize', () => {
        const testFn = () => 'test';
        const obj: QRLInternal[] = [
          // $(testFn) as QRLInternal,
          qrl('chunk.js', 's_123', ['Hello', 'World']) as QRLInternal,
          qrl('chunk.js', 's_123', ['Hello', 'World']) as QRLInternal,
          inlinedQrl(testFn, 's_inline', ['Hello']) as QRLInternal,
        ];
        const [qrl0, qrl1, qrl2] = withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0);
        expect(qrl0.$hash$).toEqual(obj[0].$hash$);
        expect(qrl0.$captureRef$).toEqual(obj[0].$captureRef$);
        expect(qrl0._devOnlySymbolRef).toEqual((obj[0] as any)._devOnlySymbolRef);
        expect(qrl1.$hash$).toEqual(obj[1].$hash$);
        expect(qrl1.$captureRef$).toEqual(obj[1].$captureRef$);
        expect(qrl1._devOnlySymbolRef).toEqual((obj[1] as any)._devOnlySymbolRef);
        expect(qrl2.$hash$).toEqual(obj[2].$hash$);
        expect(qrl2.$captureRef$).toEqual(obj[2].$captureRef$);
        expect(qrl2._devOnlySymbolRef.toString()).toEqual(
          (obj[2] as any)._devOnlySymbolRef.toString()
        );
      });
    });

    describe('TaskSerializer, ////////// ' + SerializationConstant.Task_CHAR, () => {
      it.todo('should serialize and deserialize', () => {
        ///
      });
    });

    describe('ResourceSerializer, ////// ' + SerializationConstant.Resource_CHAR, () => {
      it.todo('should serialize and deserialize', () => {
        ///
      });
    });

    describe('ComponentSerializer, ///// ' + SerializationConstant.Component_CHAR, () => {
      it('should serialize and deserialize', () => {
        const obj = component$(() => <div />);
        const container = withContainer((ssr) => ssr.addRoot(obj));
        const [srcQrl] = (obj as any)[SERIALIZABLE_STATE];
        const [dstQrl] = container.$getObjectById$(0)[SERIALIZABLE_STATE];
        expect(dstQrl.$hash$).toEqual(srcQrl.$hash$);
        expect(dstQrl.$captureRef$).toEqual(
          srcQrl.$captureRef$.length ? srcQrl.$captureRef$ : null
        );
        expect(dstQrl._devOnlySymbolRef).toEqual((srcQrl as any)._devOnlySymbolRef);
      });
    });

    describe('WrappedSignalSerializer, / ' + SerializationConstant.WrappedSignal_CHAR, () => {
      it.todo('should serialize and deserialize', () => {
        ///
      });
    });

    describe('SignalSerializer, //////// ' + SerializationConstant.Signal_CHAR, () => {
      it.todo('should serialize and deserialize', () => {
        ///
      });
    });

    describe('SignalWrapperSerializer, / ' + SerializationConstant.ComputedSignal_CHAR, () => {
      it.todo('should serialize and deserialize', () => {
        ///
      });
    });

    describe('FormDataSerializer, ////// ' + SerializationConstant.FormData_CHAR, () => {
      it('should serialize and deserialize', () => {
        const obj = new FormData();
        obj.append('someKey', 'someValue');
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
    });

    describe('JSXNodeSerializer, /////// ' + SerializationConstant.JSXNode_CHAR, () => {
      it('should serialize and deserialize', () => {
        const obj = (
          <>
            Hello World <Slot />
          </>
        ) as JSXNodeImpl<any>;
        const result = withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(
          0
        ) as JSXNodeImpl<any>;
        // be explicit about the contents so we don't check internal details
        expect(result).toBeInstanceOf(JSXNodeImpl);
        expect(result.constProps).toEqual(obj.constProps);
        expect(result.varProps).toEqual(obj.varProps);
        expect(result.children).toHaveLength(2);
        expect((result.children as any)[0]!).toBe('Hello World ');
        expect((result.children as any)[1]!).toBeInstanceOf(JSXNodeImpl);
        expect((result.children as any)[1]!.type).toBe(Slot);
      });
    });

    describe('SetSerializer, /////////// ' + SerializationConstant.Set_CHAR, () => {
      it('should serialize and deserialize', () => {
        const obj = new Set(['a', 'b', 'c']);
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
      it('should dedup internal state', () => {
        const a = { a: 'A' };
        const b = { b: 'B', a: a };
        const c = { c: 'C', a: a, b: b };
        const obj = new Set([a, b, c]);
        const value: Set<any> = withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0);
        expect(value).toEqual(obj);
        const [valueA, valueB, valueC] = Array.from(value.values());
        expect(valueB.a).toBe(valueA);
        expect(valueC.a).toBe(valueA);
        expect(valueC.b).toBe(valueB);
      });
    });

    describe('MapSerializer, /////////// ' + SerializationConstant.Map_CHAR, () => {
      it('should serialize and deserialize', () => {
        const obj = new Map([
          ['a', 1],
          ['b', 3],
          ['c', 4],
        ]);
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
      it('should dedup internal state', () => {
        const a = { a: 'A' };
        const b = { b: 'B', a: a };
        const c = { c: 'C', a: a, b: b };
        const obj = new Map<string, any>([
          ['a', a],
          ['b', b],
          ['c', c],
        ]);
        const value: Map<string, any> = withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0);
        expect(value).toEqual(obj);
        const [valueA, valueB, valueC] = Array.from(value.values());
        expect(valueB.a).toBe(valueA);
        expect(valueC.a).toBe(valueA);
        expect(valueC.b).toBe(valueB);
      });
    });

    describe('PromiseSerializer, /////// ' + SerializationConstant.Promise_CHAR, () => {
      it.todo('should serialize and deserialize', () => {
        ///
      });
    });

    describe('Uint8Serializer, ///////// ' + SerializationConstant.Uint8Array_CHAR, () => {
      it('should serialize and deserialize', () => {
        const obj = new Uint8Array([1, 2, 3, 4, 5, 0]);
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
      it('should handle large arrays', () => {
        const obj = new Uint8Array(Math.floor(Math.random() * 65530 + 1));
        crypto.getRandomValues(obj);
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
    });

    describe('PropsProxySerializer, //// ' + SerializationConstant.PropsProxy_CHAR, () => {
      it('should serialize and deserialize', () => {
        const obj = createPropsProxy({ number: 1, text: 'abc' }, { n: 2, t: 'test' });
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
      it('should serialize and deserialize with null const props', () => {
        const obj = createPropsProxy({ number: 1, text: 'abc' }, null);
        expect(withContainer((ssr) => ssr.addRoot(obj)).$getObjectById$(0)).toEqual(obj);
      });
    });

    describe('DocumentSerializer, //////', () => {
      it('should serialize and deserialize', () => {
        const obj = new SsrNode(null, SsrNode.DOCUMENT_NODE, '', [], []);
        const container = withContainer((ssr) => ssr.addRoot(obj));
        expect(container.$getObjectById$(0)).toEqual(container.element.ownerDocument);
      });
    });
  });

  describe('events', () => {
    it.todo('should serialize events');
  });

  describe('element nesting rules', () => {
    it('should throw when incorrectly nested elements', () => {
      expect(() =>
        withContainer(
          (ssr) => {
            ssr.openElement('body', []);
            ssr.openElement('p', []);
            ssr.openFragment([]);
            ssr.openElement('b', []);
            ssr.openElement('div', []);
          },
          { containerTag: 'html' }
        )
      ).toThrowError(
        [
          `SsrError(tag): HTML rules do not allow '<div>' at this location.`,
          `  (The HTML parser will try to recover by auto-closing or inserting additional tags which will confuse Qwik when it resumes.)`,
          `  Offending tag: <div>`,
          `  Existing tag context:`,
          `    <html> [html content] -> <head>, <body>`,
          `     <body> [body content] -> all tags allowed here`,
          `      <p> [phrasing content] -> <a>, <b>, <img>, <input> ... (no <div>, <p> ...)`,
          `       <b>`,
          `        <div> <= is not allowed as a child of phrasing content.`,
        ].join('\n')
      );
    });
    it('should throw when adding content to empty elements', () => {
      expect(() =>
        withContainer((ssr) => {
          ssr.openElement('img', []);
          ssr.openFragment([]);
          ssr.openElement('div', []);
        })
      ).toThrowError(
        [
          `SsrError(tag): HTML rules do not allow '<div>' at this location.`,
          `  (The HTML parser will try to recover by auto-closing or inserting additional tags which will confuse Qwik when it resumes.)`,
          `  Offending tag: <div>`,
          `  Existing tag context:`,
          `    <div> [any content]`,
          `     <img> [no-content element]`,
          `      <div> <= is not allowed as a child of no-content element.`,
        ].join('\n')
      );
    });
  });
});

function withContainer(
  ssrFn: (ssrContainer: SSRContainer) => void,
  opts: { containerTag?: string } = {}
): ClientContainer {
  const ssrContainer: SSRContainer = ssrCreateContainer({
    tagName: opts.containerTag || 'div',
  });
  ssrContainer.openContainer();
  ssrFn(ssrContainer);
  ssrContainer.closeContainer();
  const html = ssrContainer.writer.toString();
  // console.log(html);
  const container = getDomContainer(toDOM(html));
  // console.log(JSON.stringify((container as any).rawStateData, null, 2));
  return container;
}

function toHTML(jsx: JSXOutput): string {
  const ssrContainer = ssrCreateContainer({ tagName: 'div' });
  ssrContainer.openContainer();
  walkJSX(jsx, {
    enter: (jsx) => {
      if (typeof jsx.type === 'string') {
        const classAttributeExists =
          hasClassAttr(jsx.varProps) || (jsx.constProps && hasClassAttr(jsx.constProps));
        if (!classAttributeExists) {
          if (!jsx.constProps) {
            jsx.constProps = {};
          }
          jsx.constProps['class'] = '';
        }
        ssrContainer.openElement(
          jsx.type,
          varPropsToSsrAttrs(
            jsx.varProps as any,
            jsx.constProps,
            ssrContainer.serializationCtx,
            null,
            jsx.key
          ),
          constPropsToSsrAttrs(
            jsx.constProps as any,
            jsx.varProps,
            ssrContainer.serializationCtx,
            null
          )
        );
      } else {
        ssrContainer.openFragment([]);
      }
    },
    leave: (jsx) => {
      if (typeof jsx.type === 'string') {
        ssrContainer.closeElement();
      } else {
        ssrContainer.closeFragment();
      }
    },
    text: (text) => ssrContainer.textNode(String(text)),
  });
  ssrContainer.closeContainer();
  const html = ssrContainer.writer.toString();
  // console.log(html);
  return html;
}

function toDOM(html: string): HTMLElement {
  const document = createDocument();
  document.body.innerHTML = html;
  return document.body.firstElementChild! as HTMLElement;
}

function toVNode(containerElement: HTMLElement): VNode {
  const container = getDomContainer(containerElement);
  const vNode = vnode_getFirstChild(container.rootVNode)!;
  return vNode;
}
