import { Vector2 } from 'three'
import { ShapeUtils } from '../src/extras/ShapeUtils.js';

var tmp = new Vector2();
var capEnd = new Vector2();
var lineA = new Vector2();
var lineB = new Vector2();
var tangent = new Vector2();
var miter = new Vector2();

function Stroke(opt) {
    if (!(this instanceof Stroke))
        return new Stroke(opt)
    
    opt = opt||{}
    this.miterLimit = 10
    this.thickness = 20
    this.join = opt.join || 'miter'
    this.cap = opt.cap || 'butt'
    this._normal = null
    this._lastFlip = -1
    this._started = false
}

Stroke.prototype.mapThickness = function(point, i, points) {
    return this.thickness;
}

Stroke.prototype.build = function(points){
    var complex = {
        positions: [],
        cells: [],
        outter: [],  // 外墙点 - 左侧
        innner: []   // 内墙点 - 右侧
    };

    if (points.length <= 1)
        return complex;
    
    var total = points.length;

    this._lastFlip = -1;
    this._started = false;
    this._normal = null;

    for (var i = 1, count = 0; i < total; i++) {
        var last = points[i-1];
        var cur = points[i];
        var next = i < points.length - 1 ? points[i+1] : null;
        var thickness = this.mapThickness(cur, i, points);
        var amt = this._seg(complex, count, last, cur, next, thickness/2);
        count += amt;
    }

    complex.clock = ShapeUtils.isClockWise(complex.positions);
    if (!complex.clock) {
        var tmp = complex.innner;
        complex.innner = complex.outter;
        complex.outter = tmp;
    }
    
    return complex;
}


Stroke.prototype._seg = function(complex, index, last, cur, next, halfThick) {
    var count = 0;
    var cells = complex.cells;
    var positions = complex.positions;
    var outter = complex.outter;
    var innner = complex.innner;
    var capSquare = this.cap === 'square';
    var joinBevel = this.join === 'bevel';

    direction(lineA, cur, last);

    if (!this._normal) {
        this._normal = new Vector2();
        normal(this._normal, lineA);
    }

    if (!this._started) {
        this._started = true;

        if (capSquare) {
            scaleAndAdd(capEnd, last, lineA, -halfThick);
            last = capEnd.toArray();
        }

        extrusions(positions, outter, innner, last, this._normal, halfThick);
    }
    cells.push([index+0, index+1, index+2]);

    if (!next) {
        normal(this._normal, lineA);

        if (capSquare) {
            scaleAndAdd(capEnd, cur, lineA, halfThick);
            cur = capEnd.toArray();
        }
        extrusions(positions, outter, innner, cur, this._normal, halfThick);
        cells.push(this._lastFlip === 1
            ? [index, index+2, index+3]
            : [index+2, index+1, index+3]);
        
            count += 2;
    } else {
        direction(lineB, next, cur);

        var miterLen = computeMiter(tangent, miter, lineA, lineB, halfThick);

        var flip = (tangent.dot(this._normal) < 0) ? -1 : 1;

        var bevel = joinBevel;
        if (!bevel && this.join === 'miter') {
            var limit = miterLen / (halfThick);
            if (limit > this.miterLimit)
                bevel = true;
        }

        if (bevel) {
        } else { // miter
            extrusions(positions, outter, innner, cur, miter, miterLen);
            cells.push(this._lastFlip === 1
                ? [index, index+2, index+3]
                : [index+2, index+1, index+3]);
            
                flip = -1;

                this.normal = miter.clone();
                count += 2;
        }
        this._lastFlip = flip;
    }
    return count;
}

function extrusions(positions, latPoints, insPoints, point, normal, scale) {
    scaleAndAdd(tmp, point, normal, -scale);
    positions.push(tmp.clone());
    insPoints.push(tmp.clone());

    scaleAndAdd(tmp, point, normal, scale);
    positions.push(tmp.clone());
    latPoints.push(tmp.clone());
}

function direction(out, a, b) {
    var aVec = new Vector2(a[0], a[1]);
    var bVec = new Vector2(b[0], b[1]);
    out.subVectors(aVec, bVec).normalize();
    return out;
}

function normal(out, dir) {
    out.set(-dir.y, dir.x);
    return out;
}

function scaleAndAdd(capEnd, last, vec, halfThick) {
    var lastP = new Vector2(last[0], last[1]);
    var moveVec = vec.clone().setLength(halfThick);
    return capEnd.addVectors(lastP, moveVec);
}

function computeMiter(tangent, miter, lineA, lineB, halfThick) {
    tangent.addVectors(lineA, lineB).normalize();
    miter.set(-tangent.y, tangent.x);
    tmp.set(-lineA.y, lineA.x);
    return halfThick / miter.dot(tmp);
}

export { Stroke };
