"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@angular/core");
var $ = require("jquery");
var tween = require("@tweenjs/tween.js");
var SCROLL_INTO_ANIM_DURATION = 400;
var VirtualScrollComponent = (function () {
    function VirtualScrollComponent(element, renderer, zone) {
        var _this = this;
        this.element = element;
        this.renderer = renderer;
        this.zone = zone;
        this.items = [];
        this.bufferAmount = 0;
        this.scrollAnimationTime = 300;
        this.refreshHandler = function () {
            _this.refresh();
        };
        this.update = new core_1.EventEmitter();
        this.change = new core_1.EventEmitter();
        this.start = new core_1.EventEmitter();
        this.end = new core_1.EventEmitter();
        this.topPadding = 0;
        this.previousStart = 0;
        this.previousEnd = -1;
        this.previousChildHeight = 0;
        this.previousScrollNumberElements = 0;
        this.startupLoop = true;
        this.itemsHeight = {};
        this.window = window;
        /** Cache of the last scroll height to prevent setting CSS when not needed. */
        this.lastScrollHeight = -1;
        /** Cache of the last top padding to prevent setting CSS when not needed. */
        this.lastTopPadding = -1;
    }
    Object.defineProperty(VirtualScrollComponent.prototype, "parentScroll", {
        get: function () {
            return this._parentScroll;
        },
        set: function (element) {
            if (this._parentScroll === element) {
                return;
            }
            this._parentScroll = element;
            this.addParentEventHandlers(this._parentScroll);
        },
        enumerable: true,
        configurable: true
    });
    VirtualScrollComponent.prototype.onResize = function () {
        this.refresh();
    };
    VirtualScrollComponent.prototype.ngOnInit = function () {
        this.scrollbarWidth = 0; // this.element.nativeElement.offsetWidth - this.element.nativeElement.clientWidth;
        this.scrollbarHeight = 0; // this.element.nativeElement.offsetHeight - this.element.nativeElement.clientHeight;
        if (!this.parentScroll) {
            this.addParentEventHandlers(this.element.nativeElement);
        }
    };
    VirtualScrollComponent.prototype.ngOnDestroy = function () {
        this.removeParentEventHandlers();
    };
    VirtualScrollComponent.prototype.ngOnChanges = function (changes) {
        this.previousStart = 0;
        this.previousEnd = -1;
        var items = changes.items || {};
        if (changes.items != undefined && items.previousValue == undefined || (items.previousValue != undefined && items.previousValue.length === 0)) {
            this.startupLoop = true;
        }
        this.refresh();
    };
    VirtualScrollComponent.prototype.refresh = function (callback) {
        var _this = this;
        if (callback === void 0) { callback = undefined; }
        this.zone.runOutsideAngular(function () {
            requestAnimationFrame(function () {
                _this.calculateItems();
                if (callback) {
                    callback();
                }
            });
        });
    };
    VirtualScrollComponent.prototype.scrollInto = function (item, scrollEndCallback, doRefresh, additionalOffset) {
        var _this = this;
        if (scrollEndCallback === void 0) { scrollEndCallback = undefined; }
        if (doRefresh === void 0) { doRefresh = true; }
        var el = this.getElement();
        var $el = $(el);
        var offsetTop = this.getElementsOffset();
        var index = (this.items || []).indexOf(item);
        if (index < 0 || index >= (this.items || []).length)
            return;
        var d = this.calculateDimensions();
        /*if (index >= this.previousStart && index <= this.previousEnd) {
          //can accurately scroll to a rendered item using its offsetTop
          var itemElem = document.getElementById(item.id);
          if (doRefresh) {
            let scrollTop = this.lastTopPadding + itemElem.offsetTop;
            $el.animate({ scrollTop: scrollTop }, SCROLL_INTO_ANIM_DURATION, () => {
              this.scrollInto(item, scrollEndCallback, false);
            });
          }
          else {
            $el.scrollTop(this.lastTopPadding + itemElem.offsetTop);
            if (scrollEndCallback) {
              setTimeout(scrollEndCallback, 0);
            }
          }
        } else {
          let scrollTop = (Math.floor(index / d.itemsPerRow) * d.childHeight)
            //- (d.childHeight * Math.min(index, this.bufferAmount));
          $el.animate({ scrollTop: scrollTop }, SCROLL_INTO_ANIM_DURATION, () => {
            this.scrollInto(item, scrollEndCallback, false);
          });
        }*/
        var scrollTop = (Math.floor(index / d.itemsPerRow) * d.childHeight)
            - (d.childHeight * Math.min(index, this.bufferAmount)) + offsetTop + (additionalOffset ? additionalOffset : 0);
        if (this.currentTween != undefined)
            this.currentTween.stop();
        var scrollObj = { scrollTop: el.scrollTop };
        this.currentTween = new tween.Tween(scrollObj)
            .to({ scrollTop: scrollTop }, this.scrollAnimationTime)
            .easing(tween.Easing.Quadratic.Out)
            .onUpdate(function (data) {
            _this.renderer.setProperty(el, 'scrollTop', data.scrollTop);
            _this.refresh();
        })
            .start();
        var animate = function (time) {
            _this.currentTween.update(time);
            if (scrollObj.scrollTop !== scrollTop) {
                _this.zone.runOutsideAngular(function () {
                    requestAnimationFrame(animate);
                });
            }
        };
        animate();
    };
    VirtualScrollComponent.prototype.getElement = function () {
        if (this.parentScroll instanceof Window) {
            return document.scrollingElement || document.documentElement;
        }
        return this.parentScroll || this.element.nativeElement;
    };
    VirtualScrollComponent.prototype.addParentEventHandlers = function (parentScroll) {
        var _this = this;
        this.removeParentEventHandlers();
        if (parentScroll) {
            this.zone.runOutsideAngular(function () {
                _this.disposeScrollHandler =
                    _this.renderer.listen(parentScroll, 'scroll', _this.refreshHandler);
                if (parentScroll instanceof Window) {
                    _this.disposeResizeHandler =
                        _this.renderer.listen('window', 'resize', _this.refreshHandler);
                }
            });
        }
    };
    VirtualScrollComponent.prototype.removeParentEventHandlers = function () {
        if (this.disposeScrollHandler) {
            this.disposeScrollHandler();
            this.disposeScrollHandler = undefined;
        }
        if (this.disposeResizeHandler) {
            this.disposeResizeHandler();
            this.disposeResizeHandler = undefined;
        }
    };
    VirtualScrollComponent.prototype.countItemsPerRow = function () {
        return 1;
        /*let offsetTop;
        let itemsPerRow;
        let children = this.contentElementRef.nativeElement.children;
        for (itemsPerRow = 0; itemsPerRow < children.length; itemsPerRow++) {
          if (offsetTop != undefined && offsetTop !== children[itemsPerRow].offsetTop) break;
          offsetTop = children[itemsPerRow].offsetTop;
        }
        return itemsPerRow;*/
    };
    VirtualScrollComponent.prototype.getElementsOffset = function () {
        var offsetTop = 0;
        var scrollElement = this.getElement();
        if (this.containerElementRef && this.containerElementRef.nativeElement) {
            offsetTop += this.containerElementRef.nativeElement.offsetTop;
        }
        if (this.parentScroll) {
            offsetTop += this.element.nativeElement.getBoundingClientRect().top - scrollElement.getBoundingClientRect().top;
            if (!(this.parentScroll instanceof Window)) {
                offsetTop += scrollElement.scrollTop;
            }
        }
        return offsetTop;
    };
    VirtualScrollComponent.prototype.calculateDimensions = function () {
        var el = this.getElement();
        var items = this.items || [];
        var itemCount = items.length;
        var viewWidth = el.clientWidth - this.scrollbarWidth;
        var viewHeight = el.clientHeight - this.scrollbarHeight;
        var sumOfCurrentChildHeight = 0;
        var contentDimensions;
        if (this.childWidth == undefined || this.childHeight == undefined) {
            var content = this.contentElementRef.nativeElement;
            if (this.containerElementRef && this.containerElementRef.nativeElement) {
                content = this.containerElementRef.nativeElement;
            }
            contentDimensions = content.children[0] ? content.children[0].getBoundingClientRect() : {
                width: viewWidth,
                height: viewHeight
            };
            var i = this.previousStart;
            for (var _i = 0, _a = content.children; _i < _a.length; _i++) {
                var child = _a[_i];
                this.itemsHeight[i] = child.getBoundingClientRect().height;
                sumOfCurrentChildHeight += this.itemsHeight[i];
                i++;
            }
        }
        var childWidth = this.childWidth || contentDimensions.width;
        var childHeight = this.childHeight || contentDimensions.height;
        var itemsPerRow = Math.max(1, this.countItemsPerRow());
        var itemsPerRowByCalc = Math.max(1, Math.floor(viewWidth / childWidth));
        var itemsPerCol = Math.max(1, Math.floor(viewHeight / childHeight));
        var scrollTop = Math.max(0, el.scrollTop);
        var scrollHeight = (childHeight * (itemCount - this.previousEnd) + this.topPadding + sumOfCurrentChildHeight) / itemsPerRow;
        if (itemsPerCol === 1 && Math.floor(scrollTop / scrollHeight * itemCount) + itemsPerRowByCalc >= itemCount) {
            itemsPerRow = itemsPerRowByCalc;
        }
        if (scrollHeight !== this.lastScrollHeight) {
            this.renderer.setStyle(this.shimElementRef.nativeElement, 'height', scrollHeight + "px");
            this.lastScrollHeight = scrollHeight;
        }
        return {
            itemCount: itemCount,
            viewWidth: viewWidth,
            viewHeight: viewHeight,
            childWidth: childWidth,
            childHeight: childHeight,
            currentChildHeight: contentDimensions.height,
            itemsPerRow: itemsPerRow,
            itemsPerCol: itemsPerCol,
            itemsPerRowByCalc: itemsPerRowByCalc,
            scrollHeight: scrollHeight
        };
    };
    VirtualScrollComponent.prototype.calculateItems = function () {
        var _this = this;
        core_1.NgZone.assertNotInAngularZone();
        var el = this.getElement();
        var d = this.calculateDimensions();
        var items = this.items || [];
        var offsetTop = this.getElementsOffset();
        var elScrollTop = el.scrollTop;
        if (elScrollTop > d.scrollHeight) {
            elScrollTop = d.scrollHeight + offsetTop;
        }
        var scrollTop = Math.max(0, elScrollTop - offsetTop);
        // Optimization: do not update start and end indexes until scroll reaches the end of list
        /*if (this.previousStart !== undefined && this.previousEnd !== undefined) {
          let A = scrollTop;
          let B = this.lastTopPadding;
          let C = this.lastTopPadding + ((this.previousEnd - this.previousStart) * d.childHeight);
          let D = scrollTop + d.viewHeight;
          let H = d.childHeight * 1;
          if (A - B > H && C - D > H) {
            return;
          }
        }*/
        var content = this.contentElementRef.nativeElement;
        if (this.containerElementRef && this.containerElementRef.nativeElement) {
            content = this.containerElementRef.nativeElement;
        }
        var indexByScrollTop = this.previousStart;
        var childrenContent = content.children;
        if (this.topPadding > scrollTop) {
            // scroll up
            indexByScrollTop -= (this.topPadding - scrollTop) / d.childHeight;
        }
        else {
            // scroll down
            var topPaddingCurrent = this.topPadding;
            for (var _i = 0, childrenContent_1 = childrenContent; _i < childrenContent_1.length; _i++) {
                var child = childrenContent_1[_i];
                var childHeight = child.getBoundingClientRect().height;
                topPaddingCurrent = topPaddingCurrent + childHeight;
                if (scrollTop < topPaddingCurrent) {
                    indexByScrollTop += 1 - (topPaddingCurrent - scrollTop) / childHeight;
                    break;
                }
                else {
                    indexByScrollTop++;
                }
            }
        }
        var end = Math.min(d.itemCount, Math.ceil(indexByScrollTop) * d.itemsPerRow + d.itemsPerRow * (d.itemsPerCol + 1));
        var maxStartEnd = end;
        var modEnd = end % d.itemsPerRow;
        if (modEnd) {
            maxStartEnd = end + d.itemsPerRow - modEnd;
        }
        var maxStart = Math.max(0, maxStartEnd - d.itemsPerCol * d.itemsPerRow - d.itemsPerRow);
        var start = Math.min(maxStart, Math.floor(indexByScrollTop) * d.itemsPerRow);
        start = !isNaN(start) ? start : -1;
        end = !isNaN(end) ? end : -1;
        start -= this.bufferAmount;
        start = Math.max(0, start);
        end += this.bufferAmount;
        end = Math.min(items.length, end);
        if (start === 0) {
            this.topPadding = 0;
            this.previousStart = 0;
        }
        else {
            if (this.previousChildHeight && this.previousScrollNumberElements) {
                this.topPadding -= childrenContent[this.previousScrollNumberElements - 1].getBoundingClientRect().bottom - childrenContent[0].getBoundingClientRect().top - this.previousChildHeight;
                this.previousChildHeight = 0;
                this.previousScrollNumberElements = 0;
            }
            if (start < this.previousStart) {
                this.previousChildHeight = 0;
                for (var i = start; i < this.previousStart; i++) {
                    this.previousChildHeight += this.itemsHeight[i] ? this.itemsHeight[i] : d.childHeight;
                }
                this.topPadding -= this.previousChildHeight;
                this.previousScrollNumberElements = this.previousStart - start;
            }
            else {
                this.topPadding = this.topPadding + (d.currentChildHeight) * (start - this.previousStart);
            }
            this.topPadding = Math.round(this.topPadding);
        }
        if (this.topPadding !== this.lastTopPadding) {
            this.renderer.setStyle(this.contentElementRef.nativeElement, 'transform', "translateY(" + this.topPadding + "px)");
            this.renderer.setStyle(this.contentElementRef.nativeElement, 'webkitTransform', "translateY(" + this.topPadding + "px)");
            this.lastTopPadding = this.topPadding;
        }
        if (start !== this.previousStart || end !== this.previousEnd) {
            this.previousStart = start;
            this.previousEnd = end;
            this.zone.run(function () {
                // update the scroll list
                _this.viewPortItems = items.slice(start, end);
                _this.update.emit(_this.viewPortItems);
                // emit 'start' event
                if (start !== _this.previousStart && _this.startupLoop === false) {
                    _this.start.emit({ start: start, end: end });
                }
                // emit 'end' event
                if (end !== _this.previousEnd && _this.startupLoop === false) {
                    _this.end.emit({ start: start, end: end });
                }
                if (_this.startupLoop === true || (_this.previousChildHeight && _this.previousScrollNumberElements)) {
                    _this.refresh();
                }
                else {
                    _this.change.emit({ start: start, end: end });
                }
            });
        }
        else if (this.startupLoop === true) {
            this.startupLoop = false;
            this.refresh();
        }
        /*if (end === items.length) {
          var contentHeight = this.contentElementRef.nativeElement.offsetHeight;
          var delta = contentHeight - (d.childHeight * (end - start));
          //console.log('jkdelta', this.topPadding, contentHeight, this.scrollHeight + delta, this.scrollHeight, delta);
          if (delta !== 0) {
            this.renderer.setStyle(this.shimElementRef.nativeElement, 'height', `${this.lastScrollHeight + delta}px`);
            this.lastScrollHeight += delta;
          }
        }*/
    };
    VirtualScrollComponent.decorators = [
        { type: core_1.Component, args: [{
                    selector: 'virtual-scroll,[virtualScroll]',
                    exportAs: 'virtualScroll',
                    template: "\n    <div class=\"total-padding\" #shim></div>\n    <div class=\"scrollable-content\" #content>\n      <ng-content></ng-content>\n    </div>\n  ",
                    host: {
                        '[style.overflow-y]': "parentScroll ? 'hidden' : 'auto'"
                    },
                    styles: ["\n    :host {\n      overflow: hidden;\n      position: relative;\n      display: block;\n      -webkit-overflow-scrolling: touch;\n    }\n\n    .scrollable-content {\n      top: 0;\n      left: 0;\n      width: 100%;\n      height: 100%;\n      position: absolute;\n    }\n\n    .total-padding {\n      width: 1px;\n      opacity: 0;\n    }\n  "]
                },] },
    ];
    /** @nocollapse */
    VirtualScrollComponent.ctorParameters = function () { return [
        { type: core_1.ElementRef, },
        { type: core_1.Renderer2, },
        { type: core_1.NgZone, },
    ]; };
    VirtualScrollComponent.propDecorators = {
        'items': [{ type: core_1.Input },],
        'scrollbarWidth': [{ type: core_1.Input },],
        'scrollbarHeight': [{ type: core_1.Input },],
        'childWidth': [{ type: core_1.Input },],
        'childHeight': [{ type: core_1.Input },],
        'bufferAmount': [{ type: core_1.Input },],
        'scrollAnimationTime': [{ type: core_1.Input },],
        'parentScroll': [{ type: core_1.Input },],
        'update': [{ type: core_1.Output },],
        'change': [{ type: core_1.Output },],
        'start': [{ type: core_1.Output },],
        'end': [{ type: core_1.Output },],
        'contentElementRef': [{ type: core_1.ViewChild, args: ['content', { read: core_1.ElementRef },] },],
        'shimElementRef': [{ type: core_1.ViewChild, args: ['shim', { read: core_1.ElementRef },] },],
        'containerElementRef': [{ type: core_1.ContentChild, args: ['container',] },],
        'onResize': [{ type: core_1.HostListener, args: ['window:resize',] },],
    };
    return VirtualScrollComponent;
}());
exports.VirtualScrollComponent = VirtualScrollComponent;
var VirtualScrollModule = (function () {
    function VirtualScrollModule() {
    }
    VirtualScrollModule.decorators = [
        { type: core_1.NgModule, args: [{
                    exports: [VirtualScrollComponent],
                    declarations: [VirtualScrollComponent]
                },] },
    ];
    /** @nocollapse */
    VirtualScrollModule.ctorParameters = function () { return []; };
    return VirtualScrollModule;
}());
exports.VirtualScrollModule = VirtualScrollModule;
//# sourceMappingURL=virtual-scroll.js.map