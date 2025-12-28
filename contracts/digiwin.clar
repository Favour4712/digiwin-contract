
;; title: digiwin
;; version: 1.0.0
;; summary: A number guessing game with prize pools
;; description: Players guess a secret number to win the pot. First correct guess wins.

;; trails
;;

;; token definitions
;;

;; constants
;;
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u100))
(define-constant ERR_GAME_NOT_FOUND (err u101))
(define-constant ERR_GAME_ALREADY_WON (err u102))
(define-constant ERR_INVALID_GUESS (err u103))
(define-constant ERR_TRANSFER_FAILED (err u104))
(define-constant ERR_INVALID_PARAMS (err u105))
(define-constant ERR_GAME_EXPIRED (err u106))
(define-constant ERR_ALREADY_GUESSED (err u107))
(define-constant ERR_TOO_MANY_GUESSES (err u108))

;; data vars
;;
(define-data-var total-games uint u0)

;; data maps
;;

;; Game Structure
;; {
;;   id: uint,
;;   creator: principal,
;;   secret-number: uint,
;;   min-number: uint,
;;   max-number: uint,
;;   entry-fee: uint,
;;   prize-pool: uint,
;;   guess-count: uint,
;;   winner: (optional principal),
;;   status: (string-ascii 20),
;;   created-at: uint
;; }
(define-map games 
  uint 
  {
    creator: principal,
    secret-number: uint,
    min-number: uint,
    max-number: uint,
    entry-fee: uint,
    prize-pool: uint,
    guess-count: uint,
    winner: (optional principal),
    status: (string-ascii 20),
    created-at: uint
  }
)

;; Map of (game-id, player) to list of guesses
(define-map player-guesses
  {game-id: uint, player: principal}
  (list 10 uint)
)

;; List of all guesses per game (simplified to count or separate map if needed, 
;; but README implies storing them. Storing 1000 items in a list in a map value might hit limits,
;; but we'll try to follow the structure provided or a slightly optimized one if needed.
;; The README structure: (list 1000 {player: principal, guess: uint, timestamp: uint}) 
;; complex tuple inside list might be heavy. Let's use a simpler approach or the exact one if strict.)
(define-map game-guesses
  uint
  (list 1000 {player: principal, guess: uint, timestamp: uint})
)


;; public functions
;;

(define-public (create-game (min-number uint) (max-number uint) (entry-fee uint))
  (let
    (
      (game-id (var-get total-games))
      ;; Generate random secret number using block hash
      (block-hash (unwrap! (get-block-info? header-hash (- block-height u1)) (err u109)))
      (range (+ (- max-number min-number) u1))
      ;; Use slice? to get 16 bytes from 32-byte hash for conversion
      (hash-bytes (unwrap! (slice? block-hash u0 u16) (err u111)))
      (hash-bytes-16 (unwrap! (as-max-len? hash-bytes u16) (err u112)))
      (random-seed (xor (buff-to-uint-le hash-bytes-16) block-height))
      (secret (+ (mod random-seed range) min-number))
    )
    (begin
      (asserts! (<= min-number max-number) ERR_INVALID_PARAMS)
      
      (map-set games game-id {
        creator: tx-sender,
        secret-number: secret,
        min-number: min-number,
        max-number: max-number,
        entry-fee: entry-fee,
        prize-pool: u0,
        guess-count: u0,
        winner: none,
        status: "active",
        created-at: block-height
      })
      
      (var-set total-games (+ game-id u1))
      (ok game-id)
    )
  )
)

(define-public (guess (game-id uint) (number uint))
  (let
    (
      (game (unwrap! (map-get? games game-id) ERR_GAME_NOT_FOUND))
      (entry-fee (get entry-fee game))
      (current-pool (get prize-pool game))
      (secret (get secret-number game))
      (status (get status game))
      (current-guesses (default-to (list) (map-get? game-guesses game-id)))
      (player-guess-list (default-to (list) (map-get? player-guesses {game-id: game-id, player: tx-sender})))
    )
    (begin
      ;; assert game is active
      (asserts! (is-eq status "active") ERR_GAME_ALREADY_WON)
      ;; assert number in range
      (asserts! (and (>= number (get min-number game)) (<= number (get max-number game))) ERR_INVALID_GUESS)
      ;; pay entry fee
      (if (> entry-fee u0)
        (try! (stx-transfer? entry-fee tx-sender (as-contract tx-sender)))
        true
      )
      
      ;; Record guess
      ;; Add to player guesses
      (map-set player-guesses {game-id: game-id, player: tx-sender}
        (unwrap! (as-max-len? (append player-guess-list number) u10) ERR_TOO_MANY_GUESSES)
      )
      
      ;; Add to game guesses
      (map-set game-guesses game-id
        (unwrap! (as-max-len? (append current-guesses {player: tx-sender, guess: number, timestamp: block-height}) u1000) ERR_TOO_MANY_GUESSES)
      )

      ;; Check win
      (if (is-eq number secret)
        (let
          (
            (final-pool (+ current-pool entry-fee))
            (winner tx-sender)
          )
          ;; Payout
          (try! (as-contract (stx-transfer? final-pool tx-sender winner)))
          
          ;; Update game state
          (map-set games game-id (merge game {
            prize-pool: u0, ;; emptied
            guess-count: (+ (get guess-count game) u1),
            winner: (some winner),
            status: "won"
          }))
          
          (print {event: "game-won", game-id: game-id, winner: winner, prize: final-pool})
          (ok true)
        )
        ;; Else: update pool and count
        (begin
          (map-set games game-id (merge game {
            prize-pool: (+ current-pool entry-fee),
            guess-count: (+ (get guess-count game) u1)
          }))
          (ok false)
        )
      )
    )
  )
)

;; read only functions
;;

(define-read-only (get-game-info (game-id uint))
  (map-get? games game-id)
)

(define-read-only (get-game-winner (game-id uint))
  (get winner (map-get? games game-id))
)

(define-read-only (get-guess-count (game-id uint))
  (get guess-count (map-get? games game-id))
)

(define-read-only (get-prize-pool (game-id uint))
  (get prize-pool (map-get? games game-id))
)

(define-read-only (get-total-games)
  (ok (var-get total-games))
)

(define-read-only (is-game-active (game-id uint))
  (match (map-get? games game-id)
    game (ok (is-eq (get status game) "active"))
    (err ERR_GAME_NOT_FOUND)
  )
)

(define-read-only (get-player-guesses (game-id uint) (player principal))
  (default-to (list) (map-get? player-guesses {game-id: game-id, player: player}))
)

;; private functions
;;
