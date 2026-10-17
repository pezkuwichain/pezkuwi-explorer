// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { cidNumber, mrz } from './mrz';

const ADDR = '5F3ydAf91e1kcSW5NWXgBamHowmJbjSz8b1Gvd41MyzLCNpd';
const valid = (lines: string[]) => lines.every((l) => /^[A-Z0-9<]{30}$/.test(l));

describe('citizen number', () => {
  it('is the number shared with pwap and the exchange', () => {
    expect(cidNumber(97n, '5FuesBLjbaC32RwqKSJhndF3sgBG27r7thubSQ1rzg5z6sTF')).toBe('#42-97-255509');
    expect(cidNumber(null, ADDR)).toBeNull();
  });
});

describe('mrz', () => {
  it('builds three 30-character lines from the real data', () => {
    const m = mrz({ nftId: 57n, address: ADDR });
    expect(m).toEqual([
      `IDDKZ${cidNumber(57n, ADDR)!.replace(/[^0-9]/g, '')}`.padEnd(30, '<'),
      '5F3YDAF91E1KCSW5NWXGBAMHOWMJBJ',
      'WELATI<<<<<<<<<<<<<<<<<<<<<<<<',
    ]);
    expect(valid(m)).toBe(true);
  });
  it('without an NFT the number field is filler', () => {
    expect(mrz({ nftId: null, address: ADDR })[0]).toBe('IDDKZ<<<<<<<<<<<<<<<<<<<<<<<<<');
  });
  it('writes SURNAME<<GIVEN, folded to A–Z, with spaces as <', () => {
    const m = mrz({ nftId: 1n, address: ADDR, given: 'Rêber Şêx', surname: 'Çiyayî' });
    expect(m[2]).toBe('WELATI<<CIYAYI<<REBER<SEX<<<<<');
    expect(valid(m)).toBe(true);
  });
  it('drops characters that have no MRZ form and cuts long names at 30', () => {
    const m = mrz({ nftId: 1n, address: ADDR, given: 'ئاراس', surname: 'Abdulrahmanabdulrahmanabdulrahman' });
    expect(m[2]).toBe('WELATI<<ABDULRAHMANABDULRAHMANA'.slice(0, 30));
    expect(valid(m)).toBe(true);
  });
});
