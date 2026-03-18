const OPENINGS: Record<string, string> = {
  // Starting position
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR': 'Starting Position',

  // 1. e4
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR': "King's Pawn Opening",

  // 1. e4 e5
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR': "King's Pawn Game",

  // --- Sicilian Defense ---
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR': 'Sicilian Defense',
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R': 'Sicilian Defense: 2. Nf3',
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR': 'Sicilian Defense: Closed',
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/2P5/PP1P1PPP/RNBQKBNR': 'Sicilian Defense: Alapin Variation',
  'rnbqkbnr/pp1ppppp/8/8/3pP3/2P5/PP3PPP/RNBQKBNR': 'Sicilian Defense: Smith-Morra Gambit',
  'rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R': 'Sicilian Defense: 2...d6',
  'rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R': 'Sicilian Defense: Open',
  'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R': 'Sicilian Defense: Open, 5. Nc3',
  'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R': 'Sicilian Defense: Najdorf Variation',
  'rnbqkb1r/pp3ppp/3ppn2/8/3NP3/2N5/PPP2PPP/R1BQKB1R': 'Sicilian Defense: Scheveningen Variation',
  'rnbqkb1r/pp2pp1p/3p1np1/8/3NP3/2N5/PPP2PPP/R1BQKB1R': 'Sicilian Defense: Dragon Variation',
  'r1bqkb1r/pp1p1ppp/2n2n2/4p3/3NP3/2N5/PPP2PPP/R1BQKB1R': 'Sicilian Defense: Sveshnikov Variation',
  'r1bqkbnr/pp1p1ppp/2n1p3/8/3NP3/8/PPP2PPP/RNBQKB1R': 'Sicilian Defense: Taimanov Variation',
  'rnbqkbnr/1p1p1ppp/p3p3/8/3NP3/8/PPP2PPP/RNBQKB1R': 'Sicilian Defense: Kan Variation',

  // --- French Defense ---
  'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR': 'French Defense',
  'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR': 'French Defense: 2. d4',
  'rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR': 'French Defense: 2...d5',
  'rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR': 'French Defense: Advance Variation',
  'rnbqk1nr/ppp2ppp/4p3/3p4/1b1PP3/2N5/PPP2PPP/R1BQKBNR': 'French Defense: Winawer Variation',
  'rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPPN1PPP/R1BQKBNR': 'French Defense: Tarrasch Variation',
  'rnbqkb1r/ppp2ppp/4pn2/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR': 'French Defense: Classical Variation',

  // --- Caro-Kann Defense ---
  'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR': 'Caro-Kann Defense',
  'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR': 'Caro-Kann Defense: Main Line',
  'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR': 'Caro-Kann Defense: 3. Nc3',
  'rnbqkbnr/pp2pppp/2p5/3pP3/3P4/8/PPP2PPP/RNBQKBNR': 'Caro-Kann Defense: Advance Variation',
  'rn1qkbnr/pp2pppp/2p5/5b2/3PN3/8/PPP2PPP/R1BQKBNR': 'Caro-Kann Defense: Classical Variation',

  // --- Ruy Lopez ---
  'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R': 'Ruy Lopez',
  'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R': 'Ruy Lopez: Morphy Defense',
  'r1bqkbnr/1ppp1ppp/p1n5/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R': 'Ruy Lopez: Morphy Defense, 4. Ba4',
  'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R': 'Ruy Lopez: Berlin Defense',
  'r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1': 'Ruy Lopez: Closed',
  'r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1': 'Ruy Lopez: Morphy Defense, 5. O-O',

  // --- Italian Game ---
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R': 'Italian Game',
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R': 'Italian Game: Giuoco Piano',
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R': 'Italian Game: Evans Gambit',
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R': 'Italian Game: Two Knights Defense',

  // --- Scotch Game ---
  'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R': 'Scotch Game',
  'r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R': 'Scotch Game: 3...exd4',
  'r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R': 'Scotch Game: 4. Nxd4',

  // --- Petrov's Defense ---
  'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R': "Petrov's Defense",
  'rnbqkb1r/pppp1ppp/5n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R': "Petrov's Defense: Classical Attack",

  // --- Philidor Defense ---
  'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R': 'Philidor Defense',

  // --- King's Gambit ---
  'rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR': "King's Gambit",
  'rnbqkbnr/pppp1ppp/8/8/4Pp2/8/PPPP2PP/RNBQKBNR': "King's Gambit Accepted",
  'rnbqk1nr/pppp1ppp/8/2b1p3/4PP2/8/PPPP2PP/RNBQKBNR': "King's Gambit Declined: Classical",

  // --- Vienna Game ---
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR': 'Vienna Game',
  'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR': 'Vienna Game: 2...Nf6',

  // --- Four Knights Game ---
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R': 'Four Knights Game',

  // --- Bishop's Opening ---
  'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR': "Bishop's Opening",

  // --- Center Game ---
  'rnbqkbnr/pppp1ppp/8/4p3/3PP3/8/PPP2PPP/RNBQKBNR': 'Center Game',

  // --- Danish Gambit ---
  'rnbqkbnr/pppp1ppp/8/8/3pP3/2P5/PP3PPP/RNBQKBNR': 'Danish Gambit',

  // --- Latvian Gambit ---
  'rnbqkbnr/pppp2pp/8/4pp2/4P3/5N2/PPPP1PPP/RNBQKB1R': 'Latvian Gambit',

  // --- Scandinavian Defense ---
  'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR': 'Scandinavian Defense',
  'rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR': 'Scandinavian Defense: 2...Qxd5',
  'rnb1kbnr/ppp1pppp/8/q7/8/2N5/PPPP1PPP/R1BQKBNR': 'Scandinavian Defense: 3...Qa5',

  // --- Alekhine's Defense ---
  'rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR': "Alekhine's Defense",
  'rnbqkb1r/pppppppp/8/3nP3/8/8/PPPP1PPP/RNBQKBNR': "Alekhine's Defense: 2. e5 Nd5",
  'rnbqkb1r/ppp1pppp/1n1p4/4P3/2PP1P2/8/PP4PP/RNBQKBNR': "Alekhine's Defense: Four Pawns Attack",

  // --- Pirc Defense ---
  'rnbqkbnr/ppp1pppp/3p4/8/4P3/8/PPPP1PPP/RNBQKBNR': 'Pirc Defense',
  'rnbqkb1r/ppp1pp1p/3p1np1/8/3PP3/2N5/PPP2PPP/R1BQKBNR': 'Pirc Defense: Classical Variation',
  'rnbqkb1r/ppp1pp1p/3p1np1/8/3PPP2/2N5/PPP3PP/R1BQKBNR': 'Pirc Defense: Austrian Attack',

  // --- Modern Defense ---
  'rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR': 'Modern Defense',

  // --- Owen's Defense ---
  'rnbqkbnr/p1pppppp/1p6/8/4P3/8/PPPP1PPP/RNBQKBNR': "Owen's Defense",

  // --- Nimzowitsch Defense ---
  'r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR': 'Nimzowitsch Defense',

  // 1. d4
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR': "Queen's Pawn Opening",
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR': "Queen's Pawn Game",

  // --- Queen's Gambit ---
  'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR': "Queen's Gambit",
  'rnbqkbnr/ppp1pppp/8/8/2pP4/8/PP2PPPP/RNBQKBNR': "Queen's Gambit Accepted",
  'rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR': "Queen's Gambit Declined",
  'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR': "Queen's Gambit Declined: Orthodox",
  'rnbqk2r/ppp2ppp/4pn2/3p4/1bPP4/2N2N2/PP2PPPP/R1BQKB1R': "Queen's Gambit Declined: Ragozin Defense",

  // --- Slav Defense ---
  'rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR': 'Slav Defense',
  'rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R': 'Semi-Slav Defense',

  // --- Nimzo-Indian Defense ---
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR': 'Nimzo-Indian Defense',
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PPQ1PPPP/R1B1KBNR': 'Nimzo-Indian Defense: Classical Variation',
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N1P3/PP3PPP/R1BQKBNR': 'Nimzo-Indian Defense: Rubinstein Variation',

  // --- King's Indian Defense ---
  'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR': "King's Indian Defense",
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR': "King's Indian Defense: Classical Variation",
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N2P2/PP4PP/R1BQKBNR': "King's Indian Defense: Saemisch Variation",

  // --- Queen's Indian Defense ---
  'rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R': "Queen's Indian Defense",

  // --- Bogo-Indian Defense ---
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/5N2/PP2PPPP/RNBQKB1R': 'Bogo-Indian Defense',

  // --- Grunfeld Defense ---
  'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR': 'Grunfeld Defense',
  'rnbqkb1r/ppp1pp1p/6p1/3n4/3P4/2N5/PP2PPPP/R1BQKBNR': 'Grunfeld Defense: Exchange Variation',

  // --- Dutch Defense ---
  'rnbqkbnr/ppppp1pp/8/5p2/3P4/8/PPP1PPPP/RNBQKBNR': 'Dutch Defense',
  'rnbqkb1r/ppppp2p/5np1/5p2/3P4/6P1/PPP1PPBP/RNBQK1NR': 'Dutch Defense: Leningrad Variation',
  'rnbqkb1r/pppp2pp/4pn2/5p2/2PP4/6P1/PP2PP1P/RNBQKBNR': 'Dutch Defense: Stonewall Variation',

  // --- Benoni Defense ---
  'rnbqkb1r/pp1ppppp/5n2/2pP4/2P5/8/PP2PPPP/RNBQKBNR': 'Benoni Defense',
  'rnbqkb1r/pp1p1ppp/4pn2/2pP4/2P5/8/PP2PPPP/RNBQKBNR': 'Modern Benoni',
  'rnbqkb1r/p2ppppp/5n2/1ppP4/2P5/8/PP2PPPP/RNBQKBNR': 'Benko Gambit',

  // --- Budapest Gambit ---
  'rnbqkb1r/pppp1ppp/5n2/4p3/2PP4/8/PP2PPPP/RNBQKBNR': 'Budapest Gambit',

  // --- Old Indian Defense ---
  'rnbqkb1r/ppp1pppp/3p1n2/8/2PP4/8/PP2PPPP/RNBQKBNR': 'Old Indian Defense',

  // --- London System ---
  'rnbqkb1r/ppp1pppp/5n2/3p4/3P1B2/5N2/PPP1PPPP/RN1QKB1R': 'London System',

  // --- Trompowsky Attack ---
  'rnbqkb1r/pppppppp/5n2/6B1/3P4/8/PPP1PPPP/RN1QKBNR': 'Trompowsky Attack',

  // --- Torre Attack ---
  'rnbqkb1r/pppp1ppp/4pn2/6B1/3P4/5N2/PPP1PPPP/RN1QKB1R': 'Torre Attack',

  // --- Colle System ---
  'rnbqkb1r/ppp1pppp/5n2/3p4/3P4/4PN2/PPP2PPP/RNBQKB1R': 'Colle System',

  // 1. c4 English Opening
  'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR': 'English Opening',
  'rnbqkbnr/pp1ppppp/8/2p5/2P5/8/PP1PPPPP/RNBQKBNR': 'English Opening: Symmetrical Variation',
  'rnbqkbnr/pppp1ppp/8/4p3/2P5/8/PP1PPPPP/RNBQKBNR': 'English Opening: Reversed Sicilian',
  'rnbqkbnr/pppp1ppp/8/4p3/2P5/2N5/PP1PPPPP/R1BQKBNR': 'English Opening: Four Knights Variation',

  // 1. Nf3 Reti Opening
  'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R': 'Reti Opening',
  'rnbqkbnr/ppp1pppp/8/3p4/8/5N2/PPPPPPPP/RNBQKB1R': 'Reti Opening: 1...d5',
  'rnbqkbnr/ppp1pppp/8/3p4/2P5/5N2/PP1PPPPP/RNBQKB1R': 'Reti Opening: 2. c4',

  // 1. f4 Bird's Opening
  'rnbqkbnr/pppppppp/8/8/5P2/8/PPPPP1PP/RNBQKBNR': "Bird's Opening",

  // --- Catalan Opening ---
  'rnbqkb1r/pppp1ppp/4pn2/8/2PP4/6P1/PP2PP1P/RNBQKBNR': 'Catalan Opening',
  'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/6P1/PP2PPBP/RNBQK1NR': 'Catalan Opening: Open Variation',
};

export function lookupOpening(fen: string): string | null {
  const board = fen.split(' ')[0];
  return OPENINGS[board] ?? null;
}
