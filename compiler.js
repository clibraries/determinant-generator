/*
Copyright (C) 2023 clibraries 

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

function LookupNode(row, col) {
  this.row = row;
  this.col = col;
}

function MultiplyNode(left, right) {
  this.left = left;
  this.right = right;
}

function SumNode(terms) {
  this.terms = terms;
}

function NegateNode(expr) {
  this.expr = expr;
}

function determinantExpr(n) {
  var mask = new Uint8Array(n).fill(0);

  function submatrix(row) {
    if (row == n - 1) {
      for (var col = 0; col < n; ++col) {
        if (!mask[col]) {
          return new LookupNode(row, col);
        }
      }
      throw Error("assertion failure");
    }

    var sign = 1;
    var terms = [];

    for (var col = 0; col < n; ++col) {
      if (mask[col]) continue;
      mask[col] = 1;

      var coef = new LookupNode(row, col);
      if (!sign) {
        coef = new NegateNode(coef);
      }

      terms.push(new MultiplyNode(coef, submatrix(row + 1)));

      sign = !sign;
      mask[col] = 0;
    }

    return new SumNode(terms);
  }

  return submatrix(0);
}

function isAtom(expr) {
  return (expr instanceof LookupNode);
}

function zeroPad(num, digits) {
  var suffix = (num | 0).toString();

  var prefix = "";
  for (var j = 0; j < digits - suffix.length; ++j) {
    prefix += "0";
  }

  return prefix + suffix;
}

function SubExpr() {
  this.id = 0;
  this.use = 0;
}

function compile(topExpr, n) {
  var digits = 1 + ((n / 10) | 0);

  function compileExpr(e) {
    if (e instanceof LookupNode) {
      return "m[" + zeroPad(e.row, digits) + "][" + zeroPad(e.col, digits) + "]";
    } else if (e instanceof MultiplyNode) {
      var a = [compileExpr(e.left), compileExpr(e.right)];
      a.sort((a, b) => a.localeCompare(b));
      return a[0] + " * " + a[1];
    } else if (e instanceof SumNode) {
      var a = e.terms.map(compileExpr);
      a.sort((a, b) => a.localeCompare(b));
      return "(" + a.join(" + ") + ")";
    } else if (e instanceof NegateNode) {
      return "-" + compileExpr(e.expr);
    } else {
      throw Error("unknown error");
    }
  }

  function varName(id) {
    return "a" + id;
  }

  var idCounter = 1;
  var dupTable = {};

  function wrapWithDedupLogic(f) {
    return (expr) => {
      var text = f(expr);

      if (isAtom(expr)) {
        expr.id = text;
      } else {
        var id = dupTable[text];
        if (id === undefined) {
            id = varName(idCounter++);
            dupTable[text] = id;
        }
        expr.id = id;
      }

      return text;
    };
  }

  compileExpr = wrapWithDedupLogic(compileExpr);
  var math = compileExpr(topExpr);

  function varDef(id, val) {
    return "var " + id + " = " + val + ";\n";
  }

  var defined = {};

  var prog = "";

  function genProg(e) {
    if (defined[e.id]) {
      return;
    }
    defined[e.id] = true;

    if (e instanceof LookupNode) {
    } else if (e instanceof MultiplyNode) {
      genProg(e.left);
      genProg(e.right);
      prog += varDef(e.id, "" + e.left.id + " * " + e.right.id);
    } else if (e instanceof SumNode) {
      e.terms.forEach(genProg);
      prog += varDef(e.id, e.terms.map(p => p.id).join(" + "));
    } else if (e instanceof NegateNode) {
      genProg(e.expr);
      prog += varDef(e.id, "-" + e.expr.id);
    } else {
      throw Error("unknown error");
    }
  }

  genProg(topExpr);
  prog += "return " + topExpr.id + ";\n";
    return {
        program: prog,
        math: math
    };
}
