interface BoardControlsProps {
  turn: 'w' | 'b';
  orientation: 'white' | 'black';
  onToggleTurn: () => void;
  onFlipBoard: () => void;
  onReset: () => void;
  onClear: () => void;
}

export default function BoardControls({
  turn,
  orientation,
  onToggleTurn,
  onFlipBoard,
  onReset,
  onClear,
}: BoardControlsProps) {
  return (
    <div className="board-controls">
      <button className="control-btn turn-btn" onClick={onToggleTurn}>
        <span
          className="turn-indicator"
          style={{
            backgroundColor: turn === 'w' ? 'var(--piece-white)' : 'var(--piece-black)',
            border: '1px solid var(--text-dim)',
          }}
        />
        {turn === 'w' ? "White's" : "Black's"} turn
      </button>

      <button
        className="control-btn flip-btn"
        onClick={onFlipBoard}
        title="Flip board"
      >
        <span className="flip-icon">&#8693;</span>
        {orientation === 'white' ? 'White' : 'Black'} POV
      </button>

      <button className="control-btn" onClick={onReset}>
        Reset
      </button>

      <button className="control-btn" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
