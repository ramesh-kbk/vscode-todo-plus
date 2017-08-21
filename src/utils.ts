
/* IMPORT */

import * as _ from 'lodash';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import * as pify from 'pify';
import * as vscode from 'vscode';
import * as Commands from './commands';
import Config from './config';
import Consts from './consts';

/* UTILS */

const Utils = {

  initCommands ( context: vscode.ExtensionContext ) {

    const {commands, keybindings} = vscode.extensions.getExtension ( 'fabiospampinato.vscode-todo-plus' ).packageJSON.contributes;

    commands.forEach ( ({ command, title }) => {

      const commandName = _.last ( command.split ( '.' ) ) as string,
            handler = Commands[commandName],
            disposable = vscode.commands.registerCommand ( command, () => handler () );

      context.subscriptions.push ( disposable );

    });

    keybindings.forEach ( ({ command }) => {

      const commandName = _.last ( command.split ( '.' ) ) as string,
            disposable = vscode.commands.registerTextEditorCommand ( command, Commands[commandName] );

      context.subscriptions.push ( disposable );

    });

    return Commands;

  },

  initLanguage () {

    vscode.languages.setLanguageConfiguration ( Consts.languageId, {
      indentationRules: {
        increaseIndentPattern: Consts.regexes.indent,
        decreaseIndentPattern: Consts.regexes.outdent
      }
    });

  },

  getAllMatches ( str: string, regex: RegExp, multi: boolean = true ) {

    regex = multi ? new RegExp ( regex.source, 'gm' ) : regex;

    let match,
        matches = [];

    while ( match = regex.exec ( str ) ) {

      matches.push ( match );

    }

    return matches;

  },

  editor: {

    isSupported ( textEditor?: vscode.TextEditor ) {

      return textEditor && ( textEditor.document.languageId === Consts.languageId );

    },

    async replaceRange ( textEditor: vscode.TextEditor, lineNr: number, replacement: string, fromCh: number, toCh?: number ) {

      const {default: DocumentDecorator} = require ( './todo/decorators/document' ), // In order to avoid a cyclic dependency
            range = new vscode.Range ( lineNr, fromCh, lineNr, toCh || fromCh ),
            replace = vscode.TextEdit.replace ( range, replacement ),
            uri = textEditor.document.uri,
            edit = new vscode.WorkspaceEdit ();

      edit.set ( uri, [replace] );

      await vscode.workspace.applyEdit ( edit );

      DocumentDecorator.decorate ( textEditor );

    }

  },

  file: {

    open ( filepath, isTextDocument = true ) {

      filepath = path.normalize ( filepath );

      const fileuri = vscode.Uri.file ( filepath );

      if ( isTextDocument ) {

        return vscode.workspace.openTextDocument ( fileuri )
                                .then ( vscode.window.showTextDocument );

      } else {

        return vscode.commands.executeCommand ( 'vscode.open', fileuri );

      }

    },

    async read ( filepath ) {

      try {
        return ( await pify ( fs.readFile )( filepath, { encoding: 'utf8' } ) ).toString ();
      } catch ( e ) {
        return;
      }

    },

    readSync ( filepath ) {

      try {
        return ( fs.readFileSync ( filepath, { encoding: 'utf8' } ) ).toString ();
      } catch ( e ) {
        return;
      }

    },

    async make ( filepath, content ) {

      await pify ( mkdirp )( path.dirname ( filepath ) );

      return Utils.file.write ( filepath, content );

    },

    async write ( filepath, content ) {

      return pify ( fs.writeFile )( filepath, content, {} );

    }

  },

  todo: {

    getFiles ( folderPath ) {

      const config = Config.get (),
            {extensions} = vscode.extensions.getExtension ( 'fabiospampinato.vscode-todo-plus' ).packageJSON.contributes.languages[0],
            files = _.uniq ([ config.file, ...extensions ]);

      return files.map ( file => path.join ( folderPath, file ) );

    },

    get ( folderPath ) {

      const files = Utils.todo.getFiles ( folderPath );

      for ( let file of files ) {

        const content = Utils.file.readSync ( file );

        if ( _.isUndefined ( content ) ) continue;

        return {
          path: file,
          content
        };

      }

    }

  }

};

/* EXPORT */

export default Utils;
