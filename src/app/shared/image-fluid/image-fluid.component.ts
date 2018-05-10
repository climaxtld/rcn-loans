import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-image-fluid',
  templateUrl: './image-fluid.component.html',
  styleUrls: ['./image-fluid.component.scss']
})
export class ImageFluidComponent implements OnInit {
  innerHeight: any;
  constructor() {
    this.innerHeight = (window.screen.height) + 'px';
  }

  ngOnInit() {}
}
