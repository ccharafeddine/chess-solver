import { useEffect, useRef, useState, type ChangeEvent } from 'react';

function MoveButton({
  san,
  ply,
  cursor,
  onJump,
}: {
  san: string;
  ply: number;
  cursor: number;
  onJump: (cursor: number) => void;
}) {
  return (
    <button
      type="button"
      className={cursor === ply ? 'move-san move-san-active' : 'move-san'}
      onClick={() => onJump(ply)}
    >
      {san}
    </button>
  );
}

interface NotationPanelProps {
  fen: string;
  moves: string[];
  cursor: number;
  fenError: string | null;
  pgnError: string | null;
  onLoadFen: (text: string) => void;
  onJump: (cursor: number) => void;
  onImportPgn: (text: string) => void;
  onExportPgn: () => void;
}

export default function NotationPanel({
  fen,
  moves,
  cursor,
  fenError,
  pgnError,
  onLoadFen,
  onJump,
  onImportPgn,
  onExportPgn,
}: NotationPanelProps) {
  // Track the last FEN we synced from, and reset the field when the board
  // position changes (navigation, a loaded game). Typing does not change
  // `fen`, so an in-progress edit survives a click on Load.
  const [prevFen, setPrevFen] = useState(fen);
  const [draft, setDraft] = useState(fen);
  if (fen !== prevFen) {
    setPrevFen(fen);
    setDraft(fen);
  }
  const [copied, setCopied] = useState(false);
  const [paste, setPaste] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyFen = async () => {
    try {
      await navigator.clipboard.writeText(fen);
      setCopied(true);
      return;
    } catch {
      // The clipboard API can fail outside a secure context. Fall back to a
      // selection copy, still inside the renderer.
    }
    const area = document.createElement('textarea');
    area.value = fen;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (ok) setCopied(true);
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    file.text().then(onImportPgn).catch(() => onImportPgn(''));
  };

  const rows: { number: number; white: string; whitePly: number; black?: string; blackPly?: number }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      number: i / 2 + 1,
      white: moves[i],
      whitePly: i + 1,
      black: moves[i + 1],
      blackPly: moves[i + 1] ? i + 2 : undefined,
    });
  }

  return (
    <section className="notation-panel" aria-label="Position and game">
      <div className="notation-label">FEN</div>
      <form
        className="fen-row"
        onSubmit={(event) => {
          event.preventDefault();
          onLoadFen(draft);
        }}
      >
        <input
          className="fen-input"
          aria-label="FEN"
          aria-invalid={fenError ? true : undefined}
          spellCheck={false}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="control-btn">
          Load
        </button>
        <button type="button" className="control-btn" onClick={copyFen}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </form>
      {fenError && (
        <p className="notation-error" role="alert">
          {fenError}
        </p>
      )}

      <div className="notation-heading">
        <div className="notation-label">Moves</div>
        <span className="notation-count">
          {cursor}/{moves.length}
        </span>
      </div>
      <div className="move-list" role="list">
        {moves.length === 0 && (
          <p className="notation-empty">No moves yet. Play on the board or import a PGN.</p>
        )}
        {rows.map((row) => (
          <div key={row.number} className="move-row" role="listitem">
            <span className="move-num">{row.number}.</span>
            <MoveButton san={row.white} ply={row.whitePly} cursor={cursor} onJump={onJump} />
            {row.black && row.blackPly !== undefined ? (
              <MoveButton san={row.black} ply={row.blackPly} cursor={cursor} onJump={onJump} />
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
      <div className="notation-nav">
        <button type="button" className="control-btn" onClick={() => onJump(0)} disabled={cursor === 0} title="Start">
          |◀
        </button>
        <button
          type="button"
          className="control-btn"
          onClick={() => onJump(cursor - 1)}
          disabled={cursor === 0}
          title="Back"
        >
          ◀
        </button>
        <button
          type="button"
          className="control-btn"
          onClick={() => onJump(cursor + 1)}
          disabled={cursor >= moves.length}
          title="Forward"
        >
          ▶
        </button>
        <button
          type="button"
          className="control-btn"
          onClick={() => onJump(moves.length)}
          disabled={cursor >= moves.length}
          title="End"
        >
          ▶|
        </button>
      </div>

      <div className="notation-actions">
        <button type="button" className="control-btn" onClick={() => fileRef.current?.click()}>
          Import PGN
        </button>
        <button type="button" className="control-btn" onClick={onExportPgn}>
          Export PGN
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pgn,.txt,text/plain"
          hidden
          onChange={onFile}
        />
      </div>
      <details className="pgn-paste">
        <summary>Paste PGN</summary>
        <textarea
          aria-label="PGN"
          value={paste}
          spellCheck={false}
          onChange={(event) => setPaste(event.target.value)}
          placeholder="1. e4 e5 2. Nf3 ..."
        />
        <button
          type="button"
          className="control-btn"
          onClick={() => onImportPgn(paste)}
        >
          Load game
        </button>
      </details>
      {pgnError && (
        <p className="notation-error" role="alert">
          {pgnError}
        </p>
      )}
    </section>
  );
}
