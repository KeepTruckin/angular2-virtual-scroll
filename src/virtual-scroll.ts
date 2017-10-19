import {
  Component,
  ContentChild,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  NgModule,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  Renderer2,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

import * as $ from 'jquery';
import * as tween from '@tweenjs/tween.js'

export interface ChangeEvent {
  start?: number;
  end?: number;
}

const SCROLL_INTO_ANIM_DURATION = 400;

@Component({
  selector: 'virtual-scroll,[virtualScroll]',
  exportAs: 'virtualScroll',
  template: `
    <div class="total-padding" #shim></div>
    <div class="scrollable-content" #content>
      <ng-content></ng-content>
    </div>
  `,
  host: {
    '[style.overflow-y]': "parentScroll ? 'hidden' : 'auto'"
  },
  styles: [`
    :host {
      overflow: hidden;
      position: relative;
	  display: block;
      -webkit-overflow-scrolling: touch;
    }
    .scrollable-content {
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      position: absolute;
    }
    .total-padding {
      width: 1px;
      opacity: 0;
    }
  `]
})
export class VirtualScrollComponent implements OnInit, OnChanges, OnDestroy {

  @Input()
  items: any[] = [];

  @Input()
  scrollbarWidth: number;

  @Input()
  scrollbarHeight: number;

  @Input()
  childWidth: number;

  @Input()
  childHeight: number;

  @Input()
  bufferAmount: number = 0;

  @Input()
  scrollAnimationTime: number = 1500;

  private refreshHandler = () => {
    this.refresh();
  };
  private _parentScroll: Element | Window;
  @Input()
  set parentScroll(element: Element | Window) {
    if (this._parentScroll === element) {
      return;
    }
    this._parentScroll = element;
    this.addParentEventHandlers(this._parentScroll);
  }

  get parentScroll(): Element | Window {
    return this._parentScroll;
  }

  @Output()
  update: EventEmitter<any[]> = new EventEmitter<any[]>();
  viewPortItems: any[];

  @Output()
  change: EventEmitter<ChangeEvent> = new EventEmitter<ChangeEvent>();

  @Output()
  start: EventEmitter<ChangeEvent> = new EventEmitter<ChangeEvent>();

  @Output()
  end: EventEmitter<ChangeEvent> = new EventEmitter<ChangeEvent>();

  @ViewChild('content', { read: ElementRef })
  contentElementRef: ElementRef;

  @ViewChild('shim', { read: ElementRef })
  shimElementRef: ElementRef;

  @ContentChild('container')
  containerElementRef: ElementRef;

  previousStart: number;
  previousEnd: number;
  startupLoop: boolean = true;
  currentTween: any;

  private disposeScrollHandler: () => void | undefined;
  private disposeResizeHandler: () => void | undefined;

  /** Cache of the last scroll height to prevent setting CSS when not needed. */
  private lastScrollHeight = -1;

  /** Cache of the last top padding to prevent setting CSS when not needed. */
  private lastTopPadding = -1;

  constructor(
    private readonly element: ElementRef,
    private readonly renderer: Renderer2,
    private readonly zone: NgZone) { }

  ngOnInit() {
    this.scrollbarWidth = 0; // this.element.nativeElement.offsetWidth - this.element.nativeElement.clientWidth;
    this.scrollbarHeight = 0; // this.element.nativeElement.offsetHeight - this.element.nativeElement.clientHeight;

    if (!this.parentScroll) {
      this.addParentEventHandlers(this.element.nativeElement);
    }
  }

  ngOnDestroy() {
    this.removeParentEventHandlers();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.previousStart = undefined;
    this.previousEnd = undefined;
    const items = (changes as any).items || {};
    if ((changes as any).items != undefined && items.previousValue == undefined || (items.previousValue != undefined && items.previousValue.length === 0)) {
      this.startupLoop = true;
    }
    this.refresh();
  }

  refresh(callback: Function = undefined) {
    this.zone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        this.calculateItems();
        if (callback) {
          callback();
        }
      });
    });
  }

  scrollInto(item: any, scrollEndCallback: Function = undefined, doRefresh: boolean = true) {
    let el: Element = this.parentScroll instanceof Window ? document.body : this.parentScroll || this.element.nativeElement;
    let $el = $(el);
    let index: number = (this.items || []).indexOf(item);
    if (index < 0 || index >= (this.items || []).length) return;

    let d = this.calculateDimensions();

    if (index >= this.previousStart && index <= this.previousEnd) {
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
    }

    /*let scrollTop = (Math.floor(index / d.itemsPerRow) * d.childHeight)
      - (d.childHeight * Math.min(index, this.bufferAmount));

    if (this.currentTween != undefined) this.currentTween.stop()
    this.currentTween = new tween.Tween({ scrollTop: el.scrollTop })
      .to({ scrollTop }, this.scrollAnimationTime)
      .easing(tween.Easing.Quadratic.Out)
      .onUpdate((data) => {
        this.renderer.setProperty(el, 'scrollTop', data.scrollTop);
        this.refresh();
      })
      .start();

    const animate = (time?) => {
      this.currentTween.update(time);
      if (this.currentTween._object.scrollTop !== scrollTop) {
        this.zone.runOutsideAngular(() => {
          requestAnimationFrame(animate);
        });
      }
    };

    animate();*/
  }

  private addParentEventHandlers(parentScroll: Element | Window) {
    this.removeParentEventHandlers();
    if (parentScroll) {
      this.zone.runOutsideAngular(() => {
        this.disposeScrollHandler =
          this.renderer.listen(parentScroll, 'scroll', this.refreshHandler);
        if (parentScroll instanceof Window) {
          this.disposeScrollHandler =
            this.renderer.listen('window', 'resize', this.refreshHandler);
        }
      });
    }
  }

  private removeParentEventHandlers() {
    if (this.disposeScrollHandler) {
      this.disposeScrollHandler();
      this.disposeScrollHandler = undefined;
    }
    if (this.disposeResizeHandler) {
      this.disposeResizeHandler();
      this.disposeResizeHandler = undefined;
    }
  }

  private countItemsPerRow() {
    return 1;
    /*let offsetTop;
    let itemsPerRow;
    let children = this.contentElementRef.nativeElement.children;
    for (itemsPerRow = 0; itemsPerRow < children.length; itemsPerRow++) {
      if (offsetTop != undefined && offsetTop !== children[itemsPerRow].offsetTop) break;
      offsetTop = children[itemsPerRow].offsetTop;
    }
    return itemsPerRow;*/
  }

  private getElementsOffset(): number {
    let offsetTop = 0;
    if (this.containerElementRef && this.containerElementRef.nativeElement) {
      offsetTop += this.containerElementRef.nativeElement.offsetTop;
    }
    if (this.parentScroll) {
      offsetTop += this.element.nativeElement.offsetTop;
    }
    return offsetTop;
  }

  private calculateDimensions() {
    let el: Element = this.parentScroll instanceof Window ? document.body : this.parentScroll || this.element.nativeElement;
    let items = this.items || [];
    let itemCount = items.length;
    let viewWidth = el.clientWidth - this.scrollbarWidth;
    let viewHeight = el.clientHeight - this.scrollbarHeight;

    let contentDimensions;
    if (this.childWidth == undefined || this.childHeight == undefined) {
      let content = this.contentElementRef.nativeElement;
      if (this.containerElementRef && this.containerElementRef.nativeElement) {
        content = this.containerElementRef.nativeElement;
      }
      contentDimensions = content.children[0] ? content.children[0].getBoundingClientRect() : {
        width: viewWidth,
        height: viewHeight
      };
    }
    let childWidth = this.childWidth || contentDimensions.width;
    let childHeight = this.childHeight || contentDimensions.height;

    let itemsPerRow = Math.max(1, this.countItemsPerRow());
    let itemsPerRowByCalc = Math.max(1, Math.floor(viewWidth / childWidth));
    let itemsPerCol = Math.max(1, Math.floor(viewHeight / childHeight));
    let elScrollTop = this.parentScroll instanceof Window
      ? (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0)
      : el.scrollTop;
    let scrollTop = Math.max(0, elScrollTop);
    const scrollHeight = childHeight * itemCount / itemsPerRow;
    if (itemsPerCol === 1 && Math.floor(scrollTop / scrollHeight * itemCount) + itemsPerRowByCalc >= itemCount) {
      itemsPerRow = itemsPerRowByCalc;
    }

    if (scrollHeight !== this.lastScrollHeight) {
      this.renderer.setStyle(this.shimElementRef.nativeElement, 'height', `${scrollHeight}px`);
      this.lastScrollHeight = scrollHeight;
    }

    return {
      itemCount: itemCount,
      viewWidth: viewWidth,
      viewHeight: viewHeight,
      childWidth: childWidth,
      childHeight: childHeight,
      itemsPerRow: itemsPerRow,
      itemsPerCol: itemsPerCol,
      itemsPerRowByCalc: itemsPerRowByCalc,
      scrollHeight,
    };
  }

  private calculateItems() {
    NgZone.assertNotInAngularZone();
    let el = this.parentScroll instanceof Window ? document.body : this.parentScroll || this.element.nativeElement;

    let d = this.calculateDimensions();

    let items = this.items || [];
    let offsetTop = this.getElementsOffset();
    let elScrollTop = this.parentScroll instanceof Window
      ? (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0)
      : el.scrollTop;

    if (elScrollTop > d.scrollHeight) {
      elScrollTop = d.scrollHeight + offsetTop;
    }

    let scrollTop = Math.max(0, elScrollTop - offsetTop);

    // Optimization: do not update start and end indexes until scroll reaches the end of list
    if (this.previousStart !== undefined && this.previousEnd !== undefined) {
      let A = scrollTop;
      let B = this.lastTopPadding;
      let C = this.lastTopPadding + ((this.previousEnd - this.previousStart) * d.childHeight);
      let D = scrollTop + d.viewHeight;
      let H = d.childHeight * 1;
      if (A - B > H && C - D > H) {
        return;
      }
    }

    let indexByScrollTop = scrollTop / d.scrollHeight * d.itemCount / d.itemsPerRow;
    let end = Math.min(d.itemCount, Math.ceil(indexByScrollTop) * d.itemsPerRow + d.itemsPerRow * (d.itemsPerCol + 1));

    let maxStartEnd = end;
    const modEnd = end % d.itemsPerRow;
    if (modEnd) {
      maxStartEnd = end + d.itemsPerRow - modEnd;
    }
    let maxStart = Math.max(0, maxStartEnd - d.itemsPerCol * d.itemsPerRow - d.itemsPerRow);
    let start = Math.min(maxStart, Math.floor(indexByScrollTop) * d.itemsPerRow);

    const topPadding = (items == null || items.length === 0) ? 0 : (d.childHeight * Math.ceil(start / d.itemsPerRow) - (d.childHeight * Math.min(start, this.bufferAmount)));

    if (topPadding !== this.lastTopPadding) {
      this.renderer.setStyle(this.contentElementRef.nativeElement, 'transform', `translateY(${topPadding}px)`);
      this.renderer.setStyle(this.contentElementRef.nativeElement, 'webkitTransform', `translateY(${topPadding}px)`);
      this.lastTopPadding = topPadding;
    }

    start = !isNaN(start) ? start : -1;
    end = !isNaN(end) ? end : -1;
    start -= this.bufferAmount;
    start = Math.max(0, start);
    end += this.bufferAmount;
    end = Math.min(items.length, end);
    if (start !== this.previousStart || end !== this.previousEnd) {

      this.zone.run(() => {
        // update the scroll list
        this.viewPortItems = items.slice(start, end);
        this.update.emit(this.viewPortItems);

        // emit 'start' event
        if (start !== this.previousStart && this.startupLoop === false) {
          this.start.emit({ start, end });
        }

        // emit 'end' event
        if (end !== this.previousEnd && this.startupLoop === false) {
          this.end.emit({ start, end });
        }

        this.previousStart = start;
        this.previousEnd = end;

        if (this.startupLoop === true) {
          this.refresh();
        } else {
          this.change.emit({ start, end });
        }
      });

    } else if (this.startupLoop === true) {
      this.startupLoop = false;
      this.refresh();
    }

    if (end === items.length) {
      var contentHeight = this.contentElementRef.nativeElement.offsetHeight;
      var delta = contentHeight - (d.childHeight * (end - start));
      //console.log('jkdelta', this.topPadding, contentHeight, this.scrollHeight + delta, this.scrollHeight, delta);
      if (delta !== 0) {
        this.renderer.setStyle(this.shimElementRef.nativeElement, 'height', `${this.lastScrollHeight + delta}px`);
        this.lastScrollHeight += delta;
      }
    }
  }
}

@NgModule({
  exports: [VirtualScrollComponent],
  declarations: [VirtualScrollComponent]
})
export class VirtualScrollModule { }
