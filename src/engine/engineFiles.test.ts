/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { ENGINE_FILES, chooseEngine } from './engineFiles';

const BIN = new URL('../../node_modules/stockfish/bin/', import.meta.url);
const MiB = 1024 * 1024;

describe('engine builds', () => {
  it('desktop keeps the full engine', () => {
    expect(ENGINE_FILES.desktop['stockfish.wasm'].source).toBe('stockfish-18.wasm');
    expect(Object.keys(ENGINE_FILES.desktop)).toEqual(['stockfish.js', 'stockfish.wasm']);
  });

  it('web ships the threaded lite engine and a single-threaded fallback', () => {
    expect(ENGINE_FILES.web['stockfish.js'].source).toBe('stockfish-18-lite.js');
    expect(ENGINE_FILES.web['stockfish.wasm'].source).toBe('stockfish-18-lite.wasm');
    expect(ENGINE_FILES.web['stockfish-single.js'].source).toBe('stockfish-18-lite-single.js');
    expect(ENGINE_FILES.web['stockfish-single.wasm'].source).toBe('stockfish-18-lite-single.wasm');
  });

  it('pairs every script with a wasm of the same base name', () => {
    for (const files of Object.values(ENGINE_FILES))
      for (const name of Object.keys(files).filter((n) => n.endsWith('.js')))
        expect(files[name.replace(/\.js$/, '.wasm')], name).toBeDefined();
  });

  it('every web engine file exists and fits a 25 MiB static-host file limit', () => {
    for (const f of Object.values(ENGINE_FILES.web)) {
      const p = new URL(f.source, BIN);
      expect(existsSync(p), f.source).toBe(true);
      expect(statSync(p).size, f.source).toBeLessThan(25 * MiB);
    }
  });

  it('picks the threaded engine with shared memory, else the web fallback', () => {
    expect(chooseEngine('web', true)).toEqual({ script: './stockfish.js', single: false });
    expect(chooseEngine('web', false)).toEqual({ script: './stockfish-single.js', single: true });
    expect(chooseEngine('desktop', true)).toEqual({ script: './stockfish.js', single: false });
    expect(chooseEngine('desktop', false)).toBeNull();
  });
});
