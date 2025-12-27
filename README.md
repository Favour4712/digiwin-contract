# DigiWin

A simple number guessing game smart contract for Stacks blockchain built with Clarity. Guess the secret number, be first to win, and claim the prize pot.

## What It Does

DigiWin allows you to:
- Create number guessing games with prize pools
- Submit guesses to find the secret number
- First correct guess wins the entire pot
- Track guess history
- Multiple simultaneous games
- Fair randomness for secret numbers

Perfect for:
- Fun quick games
- Learning randomness patterns
- Understanding first-come logic
- Building simple game mechanics
- Competitive guessing
- Prize distribution systems

## Features

- **Random Secret Numbers**: Unpredictable number generation
- **First Wins All**: Speed matters - first correct guess takes prize
- **Prize Pools**: Entry fees create growing jackpots
- **Multiple Games**: Run many games at once
- **Guess Tracking**: See all attempts
- **Range Options**: Set min/max numbers (1-100, 1-1000, etc.)
- **Instant Payouts**: Winner gets paid immediately

## Prerequisites

- [Clarinet](https://github.com/hirosystems/clarinet) installed
- Basic understanding of Stacks blockchain
- A Stacks wallet for testnet deployment

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/digiwin.git
cd digiwin

# Check Clarinet installation
clarinet --version
```

## Project Structure

```
digiwin/
├── contracts/
│   └── digiwin.clar         # Main guessing game contract
├── tests/
│   └── digiwin_test.ts      # Contract tests
├── Clarinet.toml            # Project configuration
└── README.md
```

## Usage

### Deploy Locally

```bash
# Start Clarinet console
clarinet console

# Create a game (guess between 1-100)
(contract-call? .digiwin create-game 
  u1          ;; Min number
  u100        ;; Max number
  u100000     ;; Entry fee: 0.1 STX
)

# Submit a guess
(contract-call? .digiwin guess u0 u42)  ;; Game 0, guess 42

# Check if game is active
(contract-call? .digiwin is-game-active u0)

# Get game info
(contract-call? .digiwin get-game-info u0)
```

### Contract Functions

**create-game (min-number, max-number, entry-fee)**
```clarity
(contract-call? .digiwin create-game 
  u1           ;; Minimum number
  u1000        ;; Maximum number
  u500000      ;; Entry fee: 0.5 STX
)
```
Creates a new game with secret number and returns game ID

**guess (game-id, number)**
```clarity
(contract-call? .digiwin guess u0 u777)
```
Submit your guess (pays entry fee)

**get-game-info (game-id)**
```clarity
(contract-call? .digiwin get-game-info u0)
```
Returns game details, prize pool, guess count

**get-game-winner (game-id)**
```clarity
(contract-call? .digiwin get-game-winner u0)
```
Returns the winner's address (if game is won)

**get-guess-count (game-id)**
```clarity
(contract-call? .digiwin get-guess-count u0)
```
Returns total number of guesses made

**is-game-active (game-id)**
```clarity
(contract-call? .digiwin is-game-active u0)
```
Check if game is still accepting guesses

**get-player-guesses (game-id, player)**
```clarity
(contract-call? .digiwin get-player-guesses u0 tx-sender)
```
Returns all your guesses for a game

**get-prize-pool (game-id)**
```clarity
(contract-call? .digiwin get-prize-pool u0)
```
Returns current prize pool amount

**get-total-games**
```clarity
(contract-call? .digiwin get-total-games)
```
Returns total number of games created

## How It Works

### Creating Games
1. Creator sets number range (e.g., 1-100)
2. Contract generates random secret number
3. Entry fee is set
4. Game goes live
5. Prize pool starts at zero

### Making Guesses
1. Player pays entry fee
2. Entry fee added to prize pool
3. Player submits guess
4. Contract checks if correct
5. If correct: Player wins entire pot!
6. If wrong: Game continues, pool grows

### Winning
1. First correct guess wins
2. Entire prize pool sent to winner
3. Game marked as complete
4. Winner announced publicly
5. No more guesses accepted

### Secret Number Generation
- Uses block hash for randomness
- Combined with game data
- Within specified range
- Cannot be predicted
- Verifiable after game ends

## Data Structure

### Game Structure
```clarity
{
  id: uint,
  creator: principal,
  secret-number: uint,
  min-number: uint,
  max-number: uint,
  entry-fee: uint,
  prize-pool: uint,
  guess-count: uint,
  winner: (optional principal),
  status: (string-ascii 20),  ;; "active" or "won"
  created-at: uint
}
```

### Guess Tracking
```clarity
;; Map of (game-id, player) to list of guesses
(define-map player-guesses
  {game-id: uint, player: principal}
  (list 10 uint)
)

;; List of all guesses per game
(define-map game-guesses
  uint
  (list 1000 {player: principal, guess: uint, timestamp: uint})
)
```

## Testing

```bash
# Run all tests
npm run test

# Check contract syntax
clarinet check

# Run specific test
npm run test -- digiwin
```

## Learning Goals

Building this contract teaches you:
- ✅ Random number generation
- ✅ First-come-first-served logic
- ✅ Prize pool accumulation
- ✅ Winner selection and payout
- ✅ Game state management
- ✅ Multiple concurrent games

## Example Use Cases

**Quick Prize Game:**
```clarity
;; Create fast game (1-10)
(contract-call? .digiwin create-game u1 u10 u50000)

;; Players guess quickly
(contract-call? .digiwin guess u0 u5)
(contract-call? .digiwin guess u0 u7)
(contract-call? .digiwin guess u0 u3)  ;; WINNER!
```

**High Stakes Game:**
```clarity
;; Create big prize game (1-1000)
(contract-call? .digiwin create-game u1 u1000 u5000000)

;; Players compete
(contract-call? .digiwin guess u0 u500)
(contract-call? .digiwin guess u0 u750)
(contract-call? .digiwin guess u0 u625)
```

**Community Game Night:**
```clarity
;; Create community game (1-100)
(contract-call? .digiwin create-game u1 u100 u100000)

;; Everyone plays
(contract-call? .digiwin guess u0 u42)
(contract-call? .digiwin guess u0 u69)
(contract-call? .digiwin guess u0 u21)
```

**Speed Round:**
```clarity
;; Create easy game for quick wins (1-5)
(contract-call? .digiwin create-game u1 u5 u10000)

;; Fast guessing
(contract-call? .digiwin guess u0 u3)
(contract-call? .digiwin guess u0 u4)  ;; Someone wins fast!
```

## Game Flow

### Complete Lifecycle:
```
1. CREATE GAME → Secret number set, range defined
   ↓
2. PLAYERS GUESS → Entry fees grow prize pool
   ↓
3. CORRECT GUESS → First correct wins!
   ↓
4. INSTANT PAYOUT → Winner receives entire pool
   ↓
5. GAME ENDS → Archived, winner announced
```

## Strategy Tips

### Guessing Strategy:
```
Range 1-100:
- Middle guess: 50 (safe bet)
- Lucky numbers: 7, 13, 42, 69
- Random: Better odds than patterns
- Quick: Speed matters!
```

### Probability:
```
Range 1-10:  10% chance per guess
Range 1-100: 1% chance per guess
Range 1-1000: 0.1% chance per guess

Smaller range = Better odds!
```

### When to Play:
```
New Games: Small pool, lower competition
Growing Pools: Higher prize, more players
Quick Games: Smaller ranges, faster wins
Patient Games: Larger ranges, bigger pots
```

## Prize Pool Examples

### Small Game:
```
Range: 1-10
Entry Fee: 0.05 STX
Guesses: 20
Prize Pool: 1 STX
Winner Gets: 1 STX
```

### Medium Game:
```
Range: 1-100
Entry Fee: 0.5 STX
Guesses: 50
Prize Pool: 25 STX
Winner Gets: 25 STX
```

### Large Game:
```
Range: 1-1000
Entry Fee: 1 STX
Guesses: 200
Prize Pool: 200 STX
Winner Gets: 200 STX
```

## Common Patterns

### Check Before Guessing
```clarity
;; Check if game is active
(contract-call? .digiwin is-game-active u0)

;; Check prize pool
(contract-call? .digiwin get-prize-pool u0)

;; Check your odds (range)
(contract-call? .digiwin get-game-info u0)

;; Make your guess
(contract-call? .digiwin guess u0 u42)
```

### Multiple Guesses
```clarity
;; First guess
(contract-call? .digiwin guess u0 u50)

;; Check if you won
(contract-call? .digiwin get-game-winner u0)

;; Try again if game still active
(contract-call? .digiwin guess u0 u75)
```

### Create Your Own Game
```clarity
;; Create custom range
(contract-call? .digiwin create-game u1 u50 u200000)

;; Announce to friends
;; Watch the prize pool grow
;; Someone wins eventually!
```

## Deployment

### Testnet
```bash
clarinet deployments generate --testnet --low-cost
clarinet deployments apply -p deployments/default.testnet-plan.yaml
```

### Mainnet
```bash
clarinet deployments generate --mainnet
clarinet deployments apply -p deployments/default.mainnet-plan.yaml
```

## Roadmap

- [ ] Write the core contract
- [ ] Add comprehensive tests
- [ ] Deploy to testnet
- [ ] Add hint system (higher/lower)
- [ ] Implement guess limits per player
- [ ] Add time limits for games
- [ ] Support multiple winners (top 3)
- [ ] Add leaderboard for fastest wins
- [ ] Implement bonus rounds

## Advanced Features (Future)

**Hint System:**
- "Higher" or "Lower" feedback
- Limited hints per player
- Hint costs extra fee
- Speeds up game completion

**Game Variants:**
- Timed games (must guess within X blocks)
- Limited guesses per player
- Team guessing
- Progressive jackpots

**Leaderboards:**
- Fastest wins
- Most games won
- Biggest prizes claimed
- Lucky players

**Social Features:**
- Challenge friends
- Private games
- Share game results
- Spectator mode

**Enhanced Randomness:**
- VRF integration
- Multiple entropy sources
- Provably fair verification
- Audit trail

## Security Features

- ✅ Secret number hidden until game ends
- ✅ Random generation cannot be predicted
- ✅ First correct guess wins (no disputes)
- ✅ Automatic instant payouts
- ✅ Transparent guess history
- ✅ No admin intervention needed

## Best Practices

**Creating Games:**
- Set fair entry fees
- Choose appropriate ranges
- Announce games publicly
- Monitor prize pools

**Playing Games:**
- Only risk what you can afford
- Check prize pool before guessing
- Smaller ranges = better odds
- Speed matters - guess fast!

**Strategy:**
- Study number patterns
- Use lucky numbers
- Be first to popular games
- Multiple guesses increase odds

## Important Notes

⚠️ **Know Before Playing:**
- Entry fee required per guess
- First correct guess wins all
- Results are instant and final
- No refunds on wrong guesses

💡 **Winning Tips:**
- Smaller ranges easier to win
- New games have less competition
- Quick guesses beat slow ones
- Every guess has equal odds

🎯 **Game Selection:**
- Easy (1-10): Fast, low prizes
- Medium (1-100): Balanced
- Hard (1-1000): Big prizes, tough odds

## Limitations

**Current Constraints:**
- Maximum 1000 guesses per game
- Maximum 10 guesses per player per game
- No hints or feedback (yet)
- STX prizes only

**Design Choices:**
- Simple rules keep it fun
- First-wins keeps it fast
- No hints keeps it challenging
- Random ensures fairness

## Fun Statistics

Track interesting data:
- Total games played
- Total prizes awarded
- Average guesses to win
- Fastest wins
- Biggest prize pools
- Luckiest players

## Game Difficulty

### Easy Mode (1-10):
- 10% chance per guess
- Fast games
- Small prizes
- Great for beginners

### Medium Mode (1-100):
- 1% chance per guess
- Moderate duration
- Good prizes
- Most popular

### Hard Mode (1-1000):
- 0.1% chance per guess
- Long games
- Huge prizes
- For risk-takers

### Expert Mode (1-10000):
- 0.01% chance per guess
- Epic prize pools
- Legendary wins
- Ultimate challenge

## Contributing

This is a learning project! Feel free to:
- Open issues for questions
- Submit PRs for improvements
- Fork and experiment
- Create awesome games

## License

MIT License - do whatever you want with it

## Resources

- [Clarity Language Reference](https://docs.stacks.co/clarity)
- [Clarinet Documentation](https://github.com/hirosystems/clarinet)
- [Stacks Blockchain](https://www.stacks.co/)
- [Random Number Generation](https://book.clarity-lang.org/)

---

Built while learning Clarity 🎲

## Motivational Quotes

"You miss 100% of the guesses you don't make."

"Feeling lucky? Take a guess. Win big."

"Every number is a chance. Every guess could win."

Pick your number. Make your guess. Win with DigiWin. 🎯

---

**Active Games:** ???
**Total Prize Pools:** ???
**Winners Today:** ???

**What's your lucky number?** 🍀
