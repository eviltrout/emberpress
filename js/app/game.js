/*global window*/
/*global Ember*/
/*global $*/

(function () {
  'use strict'; 

  var EmberPress = window.EmberPress = Ember.Application.create({ rootElement: $('body') });

  // Models
  EmberPress.Word = Ember.Object.extend();
  EmberPress.Letter = Ember.Object.extend();
  EmberPress.Player = Ember.Object.extend({
    
    score: 0,

    currentScore: function() {
      var result = this.get('score');
      if (this.get('isTurn')) {
        result += this.get('board.score');
      } else {
        result -= this.get('board.stolenScore');  
      }
      return result;
    }.property('board.score', 'board.stolenScore', 'isTurn'),

    // Save the current score
    updateScore: function() {
      this.set('score', this.get('currentScore'));
    },

    // Is it this player's turn?
    isTurn: function() {
      return this.get('board.currentPlayer') === this;
    }.property('board.currentPlayer')

  });

  // This model represents the board, which is basically the main object
  // in play.
  EmberPress.Board = Ember.Object.extend({

    SIZE: 5,

    rows: Ember.A(),
    word: Ember.A(),
    played: Ember.A(),

    start: function() {

      var player1 = EmberPress.Player.create({id: 'p1', board: this});

      this.set('player1', player1);
      this.set('player2', EmberPress.Player.create({id: 'p2', board: this}));
      this.set('currentPlayer', player1);

      var letterId = 0;
      for(var j=0; j< this.SIZE; j += 1) {
        var row = Ember.A();       
        for(var i=0; i<this.SIZE; i += 1) {
          var letter = EmberPress.Letter.create({
            id: letterId, 
            letter: String.fromCharCode(65 + Math.round(Math.random() * 25))
          });
          row.pushObject(letter);
          letterId += 1;          
        }
        this.rows.pushObject(row);        
      }
    },

    hasPlayed: function() {
      return this.get('played').length > 0;
    }.property('played.@each'),

    addLetter: function(letter) {
      this.get('word').pushObject(letter);
    },

    removeLetter: function(letter) {
      this.get('word').removeObject(letter);
    },

    clearWord: function() {
      this.set('word', Ember.A());
    },

    wordAsString: function() {
      var result = "";
      this.get('word').forEach(function (letter) {
        result += letter.get('letter');
      });
      return result;
    }.property('word.@each'),

    // The player who isn't playing
    otherPlayer: function() {
      if (this.get('currentPlayer') === this.get('player1')) return this.get('player2');
      return this.get('player1');
    }.property('currentPlayer'),

    // You can be stealing a score from the other player
    stolenScore: function() {
      var result = 0;
      this.get('word').forEach(function (letter) {        
        if (letter.get('owner') === this.get('otherPlayer')) {
          result += 1;
        }
      }.bind(this));
      return result;
    }.property('word.@each'),

    // Score of the current word
    score: function() {
      var result = 0;
      this.get('word').forEach(function (letter) {
        if ((letter.get('owner') !== this.get('currentPlayer')) && (!letter.get('fortified'))) {
          result += 1;
        }
      }.bind(this));
      return result;
    }.property('word.@each'),

    submitWord: function() {

      // Update the scores
      var currentPlayer = this.get('currentPlayer');

      currentPlayer.updateScore();
      this.get('otherPlayer').updateScore();

      // Mark who chose the letters
      this.get('word').forEach(function (letter) {
        // Change the color unless it's fortified
        if (!letter.get('fortified')) {
          letter.set('owner', this.get('currentPlayer'));
        }
      }.bind(this));

      // Check for fortified tiles
      for(var y=0; y<this.SIZE; y++) {
        for (var x=0; x<this.SIZE; x++) {
          var letter = this.rows[y][x];
          var owner = letter.get('owner.id');

          // Remove fortitication if present
          letter.set('fortified', false);

          if (owner) {            
            // check neighbors
            if ((y > 0) && (this.rows[y-1][x].get('owner.id') != owner)) continue;
            if ((y < this.SIZE-1) && (this.rows[y+1][x].get('owner.id') != owner)) continue;
            if ((x > 0) && (this.rows[y][x-1].get('owner.id') != owner)) continue;
            if ((x < this.SIZE-1) && (this.rows[y][x+1].get('owner.id') != owner)) continue;
            letter.set('fortified', true);
          }
        }
      }

      // Add the word to the played list
      this.get('played').addObject(EmberPress.Word.create({
        value: this.get('wordAsString'), 
        playedBy: this.get('currentPlayer')
      }));

      this.clearWord();

      // Switch turns
      this.set('currentPlayer', this.get('otherPlayer'));
    }

  });

  // Game Board
  EmberPress.BoardController = Ember.ObjectController.extend({
    clearWord: function() {
      this.get('content').clearWord();
    },

    submitWord: function() {
      this.get('content').submitWord();
    },

    showClearWord: function() {
      return this.get('content.word').length > 0;
    }.property('content.word.@each'),

    showSubmitWord: function() {
      // Word needs to be at least 2 letters long
      if (this.get('content.word').length < 2) return false;

      // We can't play previously played words or prefixes of previous words.
      var wordString = this.get('wordAsString');
      var unplayedWord = true;
      this.get('content.played').forEach(function (word) {        
        if (word.get('value').indexOf(wordString) === 0) {
          unplayedWord = false;
          return false;
        }
      });
      return unplayedWord;
    }.property('content.word.@each')
  });

  EmberPress.BoardView = Ember.View.extend({templateName: 'board'});

  // Base class to render a letter.
  EmberPress.LetterView = Ember.View.extend({
    classNameBindings: [':letter', 'chosen', 'ownerClass', 'content.fortified'],    
    boardBinding: 'controller.content',

    ownerClass: function() {
      var owner = this.get('content.owner');
      if (!owner) { return null; }
      return owner.get('id');
    }.property('content.owner'),

    // No need for a template for one letter!
    render: function(buffer) {
      buffer.push(this.get('content.letter'));
    }
  });

  // A letter in a word we're building
  EmberPress.WordLetterView = EmberPress.LetterView.extend({
    click: function() {
      this.get('board').removeLetter(this.get('content'));
    }
  });

  // A letter on the board
  EmberPress.BoardLetterView = EmberPress.LetterView.extend({

    chosen: function() {
      return this.get('board.word').findProperty('id', this.get('content.id')) ? true : false;
    }.property('board.word.@each.id'),

    click: function() {
      if (this.get('chosen')) return;
      this.get('board').addLetter(this.get('content'));
    }
  });

  EmberPress.PlayerView = Ember.View.extend({
    classNameBindings: [':player', 'content.id', 'content.isTurn'],
    templateName: 'player'
  });

  // Boilerplate below initializes the game. Routers make more sense 
  // when there is more than one URL :)
  EmberPress.ApplicationController = Ember.Controller.extend();
  EmberPress.ApplicationView = Ember.View.extend();
  var emberPressRouter = Ember.Router.extend({
    root: Ember.Route.extend({
      index: Ember.Route.extend({
        route: '/',
        connectOutlets: function (router) {
          var board = EmberPress.Board.create();
          board.start();
          router.get('applicationController').connectOutlet('board', board);
        }
      })      
    })
  });
  EmberPress.Router = emberPressRouter;
  EmberPress.initialize();

}());