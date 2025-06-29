import { QueryString } from './query-string';
import { QueryParams } from './query-params';

describe('QueryString', () => {
  let queryString: QueryString;

  beforeEach(() => {
    queryString = new QueryString();
  });

  it('should create an instance', () => {
    expect(queryString).toBeTruthy();
  });

  it('should return an empty string if no params are provided', () => {
    expect(queryString.build()).toBe('');
    expect(queryString.build(null)).toBe('');
    expect(queryString.build(undefined)).toBe('');
  });

  it('should build a query string with a single parameter', () => {
    const params: QueryParams = { key: 'value' };
    expect(queryString.build(params)).toBe('key=value');
  });

  it('should build a query string with multiple parameters', () => {
    const params: QueryParams = { key1: 'value1', key2: 'value2' };
    expect(queryString.build(params)).toBe('key1=value1&key2=value2');
  });

  it('should handle array values', () => {
    const params: QueryParams = { key: ['value1', 'value2'] };
    expect(queryString.build(params)).toBe('key=value1&key=value2');
  });

  it('should encode special characters in keys and values', () => {
    const params: QueryParams = { 'key&': 'value=', 'key 2': 'value/2' };
    const expected = 'key%26=value%3D&key%202=value%2F2';
    expect(queryString.build(params)).toBe(expected);
  });

  it('should handle different data types', () => {
    const params: QueryParams = {
      string: 'test',
      number: 123,
      booleanTrue: true,
      booleanFalse: false,
    };
    const expected = 'string=test&number=123&booleanTrue=true&booleanFalse=false';
    expect(queryString.build(params)).toBe(expected);
  });

  it('should handle non-finite numbers', () => {
    const params: QueryParams = { a: Infinity, b: -Infinity, c: NaN };
    const expected = 'a=&b=&c=';
    expect(queryString.build(params)).toBe(expected);
  });

  it('should handle null and undefined values', () => {
    const params: QueryParams = { a: null, b: undefined };
    const expected = 'a=&b=';
    expect(queryString.build(params)).toBe(expected);
  });
});
