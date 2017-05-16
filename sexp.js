function exe(code, cont)
{
    var e = new Env();
    var l = new Lex(code);
    var [tk, id] = l.peek();
    switch (tk)
    {
        case l.TT_LPAREN:
        case l.TT_IDENT:
        case l.TT_NUM:
            eval(l, e, function(result){
                cont(result);
            });
            break;
        case l.TT_INVALID:
            console.log("Error: invalid token.");
            break;
    }
}

function builtin_binsp(l, e, r, op, cont)
{
    eval(l, e, function(result) {
        function builtin_binsp_sub(lp, sum, cont2) {
            var [tk, id] = l.peek();
            if (tk === l.TT_EOT ||
                tk === l.TT_INVALID)
            {
                // error
            }
            else if (tk === l.TT_RPAREN)
            {
                l.next();
                if (lp === 0 && r) sum = -1 * sum;
                cont2(sum);
            }
            else
            {
                eval(l, e, function(res) {
                    builtin_binsp_sub(lp+1, op(sum, Number(res)), cont2);
                });
            }
        }
        
        builtin_binsp_sub(0, Number(result), function(res) { cont(res); });
    });
}

function builtin_bin(l, e, iv, op, cont)
{
    eval(l, e, function(result) {
        function builtin_bin_sub(sum, cont2) {
            var [tk, id] = l.peek();
            if (tk === l.TT_EOT ||
                tk === l.TT_INVALID)
            {
                // error
            }
            else if (tk === l.TT_RPAREN)
            {
                l.next();
                cont2(sum);
            }
            else
            {
                eval(l, e, function(res) {
                    builtin_bin_sub(op(sum, Number(res)), cont2);
                });
            }
        }

        builtin_bin_sub(op(iv, Number(result)), function(res) { cont(res); });
    });
}

function builtin_alert(l, e, cont)
{
    var [tk, id] = l.peek();
    if (tk === l.TT_EOT || tk === l.TT_INVALID)
    {
        // error
    }
    else
    {
        eval(l, e, function(result) {
            alert(result);
            var [tk4, id4] = l.next();
            if (tk4 !== l.TT_RPAREN)
            {
                // error
            }

            cont();
        });
    }
}

function builtin_print(l, e, cont)
{
    eval(l, e, function(result) {
        console.log(result);
        var [tk, id] = l.next();
        if (tk !== l.TT_RPAREN)
        {
            // error
        }

        cont();
    });
}

function builtin_sleep(l, e, cont)
{
    eval(l, e, function(result) {
        setTimeout(function() {
            var [tk, id] = l.next();
            if (tk !== l.TT_RPAREN)
            {
                // error
            }
            cont();
        }, Number(result) * 1000);
    });
}

function builtin_begin(l, e, cont)
{
    function builtin_begin_sub(lastval) {
        var [tk, id] = l.peek();
        if (tk === l.TT_INVALID ||
            tk === l.TT_EOT)
        {
            // error
        }
        else if (tk === l.TT_RPAREN)
        {
            l.next();
            cont(lastval);
        }
        else
        {
            eval(l, e, function(result) {
                builtin_begin_sub(result);
            });
        }
    }

    builtin_begin_sub(0);
}

function func_call(l, e, cont)
{
    var [tk, id] = l.peek();
    if (tk !== l.TT_LPAREN)
    {
        // error
    }
    l.next();

    var [tk2, id2] = l.next();
    //var fn = eval(l, e);

    switch (id2)
    {
        case "+":
            builtin_bin(l, e, 0,
                function(o1, o2) { return o1 + o2; },
                function(result) { cont(result); });
            break;
        case "-":
            builtin_binsp(l, e, true,
                function(o1, o2) { return o1 - o2; },
                function(result) { cont(result); });
            break;
        case "*":
            builtin_bin(l, e, 1,
                function(o1, o2) { return o1 * o2; },
                function(result) { cont(result); });
            break;
        case "/":
            builtin_binsp(l, e, false,
                function(o1, o2) { return o1 / o2; },
                function(result) { cont(result); });
            break;
        case "alert":
            builtin_alert(l, e, cont);
            break;
        case "print":
            builtin_print(l, e, cont);
            break;
        case "sleep":
            builtin_sleep(l, e, function() { cont(""); });
            break;
        case "begin":
            builtin_begin(l, e, function(result) { cont(result); });
            break;
    }
}

function eval(l, e, cont)
{
    var [tk, id] = l.peek();
    switch (tk)
    {
        case l.TT_LPAREN: // must be function call
            func_call(l, e, function(result) {
                cont(result);
            });
            break;
        case l.TT_IDENT:
            l.next();
            cont(e.lookup(id));
            break;
        case l.TT_NUM:
            l.next();
            cont(id);
            break;
    }
}

class Env
{
    constructor()
    {
        this.env = [];
    }

    lookup(id)
    {
        for (var i = this.env.length-1; i >= 0; i--)
        {
            var [i, v] = this.env[i];
            if (id === i) return v;
        }
        return;
    }

    def(i, v)
    {
        this.env.push([i, v]);
    }
}

class Lex
{
    constructor(code)
    {
        this.pos = 0;
        this.code = code;
        this.len = code.length;

        this.vec = [];

        this.TT_INVALID = Symbol("TT_INVALID");
        this.TT_LPAREN  = Symbol("TT_LPAREN");  // (
        this.TT_RPAREN  = Symbol("TT_RPAREN");  // )
        this.TT_IDENT   = Symbol("TT_IDENT");
        this.TT_NUM     = Symbol("TT_NUM");
        this.TT_EOT     = Symbol("TT_EOT");
    }

    isDigit(c)
    {
        return '0' <= c && c <= '9';
    }

    isIdent(c)
    {
        return ('a' <= c && c <= 'z') ||
            ('A' <= c && c <= 'Z') ||
            c === '_' || c === '+' || c === '-' ||
            c === '/' || c === '*';
    }

    skip()
    {
        for (; this.pos < this.len; )
        {
            var c = this.code.charAt(this.pos);
            if (c === '\r' || c === '\n' || c === '\t' || c === ' ')
            {
                this.pos++;
            }
            else if (c === ';')
            {
                while (this.pos < this.len)
                {
                    this.pos++;
                    c = this.code.charAt(this.pos);
                    if (c === '\n' || c === '\r')
                    {
                        break;
                    }
                }
            }
            else
            {
                break;
            }
        }
    }

    peek()
    {
        var ret = this.next();
        this.vec.push(ret);
        return ret;
    }

    next()
    {
        if (this.vec.length !== 0)
        {
            return this.vec.pop();
        }


        this.skip();
        if (this.pos == this.len)
        {
            return [this.TT_EOT, "EOT"];
        }

        var c = this.code.charAt(this.pos);
        switch (c)
        {
            case '(':
                this.pos++;
                return [this.TT_LPAREN, "("];
            case ')':
                this.pos++;
                return [this.TT_RPAREN, ")"];
            default:
                if (this.isDigit(c))
                {
                    var str = "";
                    for (; this.pos < this.len; )
                    {
                        c = this.code.charAt(this.pos);
                        if (this.isDigit(c))
                        {
                            str += c;
                            this.pos++;
                        }
                        else
                        {
                            break;
                        }
                    }
                    return [this.TT_NUM, str];
                }
                else if (this.isIdent(c))
                {
                    var str = "";
                    for (; this.pos < this.len; )
                    {
                        c = this.code.charAt(this.pos);
                        if (this.isIdent(c))
                        {
                            str += c;
                            this.pos++;
                        }
                        else
                        {
                            break;
                        }
                    }
                    return [this.TT_IDENT, str];
                }
                return [this.TT_INVALID, "invalid"];
        }
    }
}

