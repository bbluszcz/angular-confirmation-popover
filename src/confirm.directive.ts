import {
  Directive,
  Input,
  Output,
  EventEmitter,
  HostListener,
  ViewContainerRef,
  ComponentRef,
  OnDestroy,
  ElementRef,
  OnChanges,
  OnInit,
  ReflectiveInjector,
  ResolvedReflectiveProvider,
  ComponentResolver,
  Injector,
  Inject,
  Renderer
} from '@angular/core';
import {DOCUMENT} from '@angular/platform-browser';
import {ConfirmPopover} from './confirmPopover.component';
import {ConfirmOptions, PopoverConfirmOptions} from './confirmOptions.provider';
import {Position} from './position.provider';

/**
 * @private
 */
interface Coords {
  top: number;
  left: number;
}

/**
 * All properties can be set on the directive as attributes like so (use the `ConfirmOptions` provider to configure them globally):
 * ```
 * <button
 *  class="btn btn-default"
 *  mwl-confirm
 *  [title]="title"
 *  [message]="message"
 *  placement="left"
 *  (confirm)="confirmClicked = true"
 *  (cancel)="cancelClicked = true"
 *  [(isOpen)]="isOpen">
 *   Show confirm popover!
 * </button>
 * ```
 */
@Directive({
  selector: '[mwl-confirm]'
})
export class Confirm implements OnDestroy, OnChanges, OnInit {

  /**
   * The title of the popover.
   * Note, if you use an expression, you may want to consider using "data-title" instead of "title" so
   * that the browser doesn't show native tooltips with the angular expression listed.
   */
  @Input() title: string;

  /**
   * The body text of the popover.
   */
  @Input() message: string;

  /**
   * The text of the confirm button. Default `Confirm`
   */
  @Input() confirmText: string;

  /**
   * The text of the cancel button. Default `Cancel`
   */
  @Input() cancelText: string;

  /**
   * The placement of the popover. It can be either `top`, `right`, `bottom` or `left`. Default `top`
   */
  @Input() placement: string;

  /**
   * The bootstrap button type of the confirm button. It can be any supported bootstrap color type
   * e.g. `default`, `warning`, `danger` etc. Default `success`
   */
  @Input() confirmButtonType: string;

  /**
   * The bootstrap button type of the cancel button. It can be any supported bootstrap color type
   * e.g. `default`, `warning`, `danger` etc. Default `default`
   */
  @Input() cancelButtonType: string;

  /**
   * Set to either `confirm` or `cancel` to focus the confirm or cancel button.
   * If omitted, by default it will not focus either button.
   */
  @Input() focusButton: string;

  /**
   * Whether to hide the confirm button. Default `false`.
   */
  @Input() hideConfirmButton: boolean = false;

  /**
   * Whether to hide the cancel button. Default `false`.
   */
  @Input() hideCancelButton: boolean = false;

  /**
   * Whether to disable showing the popover. Default `false`.
   */
  @Input() isDisabled: boolean = false;

  /**
   * Will open or show the popover when changed.
   * Can be sugared with `isOpenChange` to emulate 2-way binding like so `[(isOpen)]="isOpen"`
   */
  @Input() isOpen: boolean = false;

  /**
   * Will emit when the popover is opened or closed
   */
  @Output() isOpenChange: EventEmitter<any> = new EventEmitter();

  /**
   * An expression that is called when the confirm button is clicked.
   */
  @Output() confirm: EventEmitter<any> = new EventEmitter();

  /**
   * An expression that is called when the cancel button is clicked.
   */
  @Output() cancel: EventEmitter<any> = new EventEmitter();

  /**
   * A custom CSS class to be added to the popover
   */
  @Input() popoverClass: string;

  /**
   * Append the element to the document body rather than the trigger element
   */
  @Input() appendToBody: boolean = false;

  /**
   * @private
   */
  popover: Promise<ComponentRef<ConfirmPopover>> = null;

  /**
   * @private
   */
  constructor(
    private viewContainerRef: ViewContainerRef,
    private elm: ElementRef,
    private defaultOptions: ConfirmOptions,
    private componentResolver: ComponentResolver,
    private position: Position,
    private renderer: Renderer,
    @Inject(DOCUMENT) private document: HTMLDocument
  ) {}

  /**
   * @private
   */
  ngOnInit(): void {
    // needed because of https://github.com/angular/angular/issues/6005
    setTimeout(() => {
      this.isOpenChange.emit(false);
    });
  }

  /**
   * @private
   */
  ngOnChanges(changes: any): void {
    if (changes.isOpen) {
      if (changes.isOpen.currentValue === true) {
        this.showPopover();
      } else {
        this.hidePopover();
      }
    }
  }

  /**
   * @private
   */
  ngOnDestroy(): void {
    this.hidePopover();
  }

  /**
   * @private
   */
  onConfirm(): void {
    this.confirm.emit(null);
    this.hidePopover();
  }

  /**
   * @private
   */
  onCancel(): void {
    this.cancel.emit(null);
    this.hidePopover();
  }

  private showPopover(): void {
    if (!this.popover && !this.isDisabled) {

      const options: PopoverConfirmOptions = new PopoverConfirmOptions();
      Object.assign(options, this.defaultOptions, {
        title: this.title,
        message: this.message,
        onConfirm: (): void => {
          this.onConfirm();
        },
        onCancel: (): void => {
          this.onCancel();
        }
      });

      const optionalParams: string[] = [
        'confirmText',
        'cancelText',
        'placement',
        'confirmButtonType',
        'cancelButtonType',
        'focusButton',
        'hideConfirmButton',
        'hideCancelButton',
        'popoverClass',
        'appendToBody'
      ];
      optionalParams.forEach(param => {
        if (this[param]) {
          options[param] = this[param];
        }
      });

      this.popover = this.componentResolver.resolveComponent(ConfirmPopover).then(componentFactory => {
        const binding: ResolvedReflectiveProvider[] = ReflectiveInjector.resolve([{
          provide: PopoverConfirmOptions,
          useValue: options
        }]);
        const contextInjector: Injector = this.viewContainerRef.parentInjector;
        const childInjector: Injector = ReflectiveInjector.fromResolvedProviders(binding, contextInjector);
        const popover: ComponentRef<ConfirmPopover> =
          this.viewContainerRef.createComponent(componentFactory, this.viewContainerRef.length, childInjector);
        if (this.appendToBody) {
          this.document.body.appendChild(popover.location.nativeElement);
        }
        const originalAfterViewInit: Function = popover.instance.ngAfterViewInit;
        popover.instance.ngAfterViewInit = () => {
          if (originalAfterViewInit) {
            originalAfterViewInit.call(popover.instance);
          }
          this.positionPopover();
        };
        this.isOpenChange.emit(true);
        return popover;
      });

    }
  }

  private positionPopover(): void {
    if (this.popover) {
      this.popover.then((popoverComponent: ComponentRef<ConfirmPopover>) => {
        const popover: HTMLElement = popoverComponent.location.nativeElement.children[0];
        const popoverPosition: Coords = this.position.positionElements(
          this.elm.nativeElement,
          popoverComponent.location.nativeElement.children[0],
          this.placement || this.defaultOptions.placement,
          this.appendToBody || this.defaultOptions.appendToBody
        );
        this.renderer.setElementStyle(popover, 'top', `${popoverPosition.top}px`);
        this.renderer.setElementStyle(popover, 'left', `${popoverPosition.left}px`);
      });
    }
  }

  private hidePopover(): void {
    if (this.popover) {
      this.popover.then((popoverComponent: ComponentRef<ConfirmPopover>) => {
        popoverComponent.destroy();
        this.popover = null;
        this.isOpenChange.emit(false);
      });
    }
  }

  @HostListener('document:click', ['$event.target'])
  @HostListener('document:touchend', ['$event.target'])
  private onDocumentClick(target: HTMLElement): void {

    if (this.popover && !this.elm.nativeElement.contains(target)) {
      this.popover.then((popover: ComponentRef<ConfirmPopover>) => {
        if (!popover.location.nativeElement.contains(target)) {
          this.hidePopover();
        }
      });
    }
  }

  @HostListener('click')
  private togglePopover(): void {
    if (!this.popover) {
      this.showPopover();
    } else {
      this.hidePopover();
    }
  }

  @HostListener('window:resize')
  private onResize(): void {
    this.positionPopover();
  }

}
