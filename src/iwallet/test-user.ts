// A minimal stand-in for user-event (not a dependency of this repo): the few interactions the i-Wallet screen tests need.
import { act, fireEvent } from '@testing-library/react';

export const user = {
  click: async (el: Element) => { await act(async () => { fireEvent.click(el); }); },
  type: async (el: Element, text: string) => { await act(async () => { fireEvent.change(el, { target: { value: text } }); }); },
  clear: async (el: Element) => { await act(async () => { fireEvent.change(el, { target: { value: '' } }); }); },
};
