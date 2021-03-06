import { OptionsModel } from './options.model';
import {RowsModel} from './rows.model';
import {ColorsModel} from './colors.model';
import {Log} from './log.model';
import {SelectionModel} from './selection.model';
import {IconsModel} from './icons.model';
import {SequenceInfoModel} from './sequenceInfoModel';
import {EventsModel} from './events.model';
import {PatternsModel} from './patterns.model';
import {InputModel} from './input.model';
import {ConsensusModel} from './consensus.model';

export class ProSeqViewer {
  static sqvList = [];
  divId: string;
  init: boolean;
  input: InputModel;
  params: OptionsModel;
  rows: RowsModel;
  consensus: ConsensusModel;
  regions: ColorsModel;
  patterns: PatternsModel;
  icons: IconsModel;
  labels: SequenceInfoModel;
  selection: SelectionModel;
  events: EventsModel;

  constructor(divId?: string ) {
    this.divId = divId;
    this.init = false;
    this.input = new InputModel();
    this.params = new OptionsModel();
    this.rows = new RowsModel();
    this.consensus = new ConsensusModel();
    this.regions = new ColorsModel();
    this.patterns = new PatternsModel();
    this.icons = new IconsModel();
    this.labels = new SequenceInfoModel();
    this.selection = new SelectionModel();
    this.events = new EventsModel();


    window.onresize = () => {
      this.calculateIdxs(false);
    };
    window.onclick = () => {
      this.calculateIdxs(true);
    }; // had to add this to cover mobidb toggle event
  }

  public draw(input1?, input2?, input3?, input4?, input5?, input6?, input7?) {

    ProSeqViewer.sqvList.push(this.divId);

    let inputs;
    let order;
    let labels;
    let labelsFlag;
    let startIndexes;
    let tooltips;
    let data;

    /** check and process input */
    [inputs, order] = this.input.process(input1, input2, input3, input4, input5, input6, input7);

    /** check and process parameters input */
    inputs.options = this.params.process(inputs.options);

    /** check and consensus input  and global colorScheme */
    [inputs.sequences, inputs.regions, order ] = this.consensus.process(inputs.sequences, inputs.regions, inputs.options, order);

    /** check and process patterns input */
    inputs.patterns = this.patterns.process(inputs.patterns, inputs.sequences);

    /** check and process colors input */
    inputs.regions = this.regions.process(inputs, order);

    /** check and process icons input */
    inputs.icons = this.icons.process(inputs.regions, inputs.sequences, inputs.iconsHtml, inputs.iconsPaths);

    /** check and process sequences input */
    data = this.rows.process(inputs.sequences, inputs.icons, inputs.regions, inputs.options.colorScheme, inputs.options.chunkSize);

    /** check and process labels input */
    [ labels, startIndexes, tooltips, labelsFlag ] = this.labels.process(inputs.regions, inputs.sequences);

    /** create/update sqv-body html */
    this.createGUI(data, labels, startIndexes, tooltips, inputs.options, labelsFlag);

    /** listen copy paste events */
    this.selection.process();

    /** listen selection events */
    this.events.onRegionSelected();
  }

  private generateLabels(idx, labels, startIndexes, topIndexes, chunkSize, fontSize, tooltips, data, rowMarginBottom) {
    let labelshtml = '';
    let labelsContainer = '';
    const noGapsLabels = [];

    if (labels.length > 0) {
      if (topIndexes) {
        labelshtml += `<span class="lbl-hidden" style="margin-bottom:${rowMarginBottom};"></span>`;
      }
      let flag;
      let count = -1;
      let seqN = -1;
      for (const seqNum of data) {
        if (noGapsLabels.length < data.length) {
          noGapsLabels.push(0);
        }
        seqN += 1;
        for (const res in seqNum) {
          if (seqNum[res].char && seqNum[res].char.includes('svg')) {
            flag = true;
            break;
          }
        }

        if (flag) {
          noGapsLabels[seqN] = '';
          if (idx) {
            // line with only icons, no need for index
            labelshtml += `<span class="lbl-hidden" style="margin-bottom:${rowMarginBottom}"><span class="lbl"> ${noGapsLabels[seqN]}</span></span>`;
          } else {
            labelshtml += `<span class="lbl-hidden" style="margin-bottom:${rowMarginBottom}"><span class="lbl"></span></span>`;
          }

        } else {
          count += 1;
          if (idx) {
            if (!chunkSize) {
              // lateral index regular
              labelshtml += `<span class="lbl-hidden" style="width: ${fontSize};margin-bottom:${rowMarginBottom}">
                            <span class="lbl" >${(startIndexes[count] - 1) + idx}</span></span>`;
            } else {
              let noGaps = 0;
              for (const res in seqNum) {
                if (+res <= (idx) && seqNum[res].char !== '-') {
                  noGaps += 1;
                }
              }
              // lateral index gap
              noGapsLabels[seqN] = noGaps;
              labelshtml += `<span class="lbl-hidden" style="width:  ${fontSize};margin-bottom:${rowMarginBottom}">
                            <span class="lbl" >${(startIndexes[count] - 1) + noGapsLabels[seqN]}</span></span>`;
            }

          } else {
            labelshtml += `<span class="lbl-hidden" style="margin-bottom:${rowMarginBottom}"><span class="lbl">${labels[count]}${tooltips[count]}</span></span>`;
          }
        }
        flag = false;
      }

      labelsContainer = `<span class="lblContainer" style="display: inline-block">${labelshtml}</span>`;
    }
    return labelsContainer;
  }

  private addTopIndexes(topIndexes, chunkSize, x, maxTop, rowMarginBottom) {

    let cells = '';
    // adding top indexes
    if (topIndexes) {
      let chunkTopIndex;
      if (x % chunkSize === 0 && x <= maxTop) {
        chunkTopIndex = `<span class="cell" style="-webkit-user-select: none;direction: rtl;display:block;width:0.6em;margin-bottom:${rowMarginBottom}">${x}</span>`;

      } else {
        chunkTopIndex = `<span class="cell" style="-webkit-user-select: none;display:block;visibility: hidden;margin-bottom:${rowMarginBottom}">0</span>`;
      }
      cells += chunkTopIndex;
    }
    return cells;
  }

  private createGUI(data, labels, startIndexes, tooltips, options, labelsFlag) {

    const sqvBody = document.getElementById(this.divId);

    if (!sqvBody) {
      Log.w(1, 'Cannot find sqv-body element.');
      return;
    }

    const chunkSize = options.chunkSize;
    const fontSize = options.fontSize;
    const spaceSize = options.spaceSize;
    const topIndexes = options.topIndexes;
    const lateralIndexes = options.lateralIndexes;
    const lateralIndexesGap = options.lateralIndexesGap;
    const oneLineSetting = options.oneLineSetting;
    const oneLineWidth = options.oneLineWidth;
    const rowMarginBottom = options.rowMarginBottom + ';';
    const fNum = +fontSize.substr(0, fontSize.length - 2);
    const fUnit = fontSize.substr(fontSize.length - 2, 2);



    // maxIdx = length of the longest sequence
    let maxIdx = 0;
    let maxTop = 0;
    for (const row of data) {
      if (maxIdx < Object.keys(row).length) { maxIdx = Object.keys(row).length; }
      if (maxTop < Object.keys(row).length) { maxTop = Object.keys(row).length; }
    }

    const lenghtIndex = maxIdx.toString().length;
    const indexWidth = (fNum * lenghtIndex).toString() + fUnit;

    // consider the last chunk even if is not long enough
    if (chunkSize > 0) { maxIdx += (chunkSize - (maxIdx % chunkSize)) % chunkSize; }

    // generate labels
    const labelsContainer = this.generateLabels(false, labels, startIndexes, topIndexes, false, indexWidth, tooltips, data, rowMarginBottom);

    let index = '';
    let cards = '';
    let cell;
    let entity;
    let style;
    let html = '';
    let idxNum = 0;
    let idx;
    for (let x = 1; x <= maxIdx; x++) {
      let cells = this.addTopIndexes(topIndexes, chunkSize, x, maxTop, rowMarginBottom);

      for (let y = 0; y < data.length; y++) {
        entity = data[y][x];
        style = 'font-size: 1em;display:block;height:1em;line-height:1em;margin-bottom:' + rowMarginBottom;
        if (y === data.length - 1) { style = 'font-size: 1em;display:block;line-height:1em;margin-bottom:' + rowMarginBottom; }
        if (!entity) {
          // emptyfiller
            style = 'font-size: 1em;display:block;color: rgba(0, 0, 0, 0);height:1em;line-height:1em;margin-bottom:' + rowMarginBottom;
            cell = `<span style="${style}">A</span>`; // mock char, this has to be done to have chunks all of the same length (last chunk can't be shorter)
        } else {
          if (entity.target) { style += `${entity.target}`; }
          if (entity.char && !entity.char.includes('svg')) {
            // y is the row, x is the column
            cell = `<span class="cell" data-res-x='${x}' data-res-y= '${y}' data-res-id= '${this.divId}'
                    style="${style}">${entity.char}</span>`;
          } else {
            style += '-webkit-user-select: none;';
            cell = `<span style="${style}">${entity.char}</span>`;
          }
        }
        cells += cell;
      }

      cards += `<div class="crd">${cells}</div>`; // width 3/5em to reduce white space around letters
      cells = '';


      if (chunkSize > 0 && x % chunkSize === 0) {
        // considering the row of top indexes
        if (topIndexes) {
        } else {
          idxNum += chunkSize; // lateral index (set only if top indexes missing)
          idx = idxNum - (chunkSize - 1);
        }
        // adding labels
        if (lateralIndexesGap && !topIndexes) {
          const gapsContainer = this.generateLabels(idx, labels, startIndexes, topIndexes, false, indexWidth, false, data, rowMarginBottom);
          if (oneLineSetting || labels[0] === '') {
            index = gapsContainer;  // lateral number indexes + labels
          } else {
            index = labelsContainer  + gapsContainer;  // lateral number indexes + labels
          }

          } else if (!lateralIndexesGap  && !topIndexes) {
          const gapsContainer = this.generateLabels(idx, labels, startIndexes, topIndexes, chunkSize, indexWidth, false, data, rowMarginBottom);
          if (oneLineSetting || !labelsFlag) {
            index = gapsContainer;  // lateral number indexes + labels
          } else {
            index = labelsContainer  + gapsContainer;  // lateral number indexes + labels
          }
          } else {
            index = labelsContainer;
          }

        index = `<div class="idx hidden">${index}</div>`;
        style = `font-size: ${fontSize};`;

        if (x !== maxIdx) { style += 'padding-right: ' + spaceSize + 'em;'; } else { style += 'margin-right: ' + spaceSize + 'em;'; }

        let chunk = '';
        if (labelsFlag || options.consensusType || lateralIndexes) {
          chunk = `<div class="cnk" style="${style}">${index}<div class="crds">${cards}</div></div>`;
        } else {
          chunk = `<div class="cnk" style="${style}"><div class="idx hidden"></div><div class="crds">${cards}</div></div>`;
        }
        cards = '';
        index = '';
        html += chunk;
      }
    }

    if (oneLineSetting) {
      sqvBody.innerHTML = `<div class="root" style="display: flex"><div style="${style}">${labelsContainer}</div>
                        <div style="display:inline-block;overflow-x:scroll;white-space: nowrap;width:${oneLineWidth}"> ${html}</div></div>`;
    } else {
      sqvBody.innerHTML = `<div class="root">${html}</div>`;
    }

    window.dispatchEvent(new Event('resize'));
  }

  private calculateIdxs(flag) {
    for (const id of ProSeqViewer.sqvList) {
      // console.log(document.getElementById(id))
      if (document.getElementById(id) != null) {
        const sqvBody = document.getElementById(id);
        const chunks = sqvBody.getElementsByClassName('cnk');

        let oldTop = 0;
        let newTop;
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < chunks.length; i++) {
          newTop = chunks[i].getBoundingClientRect().top;

          if (flag) {
            // avoid calculating if idx already set
            if (chunks[i].firstElementChild.className === 'idx') {
              return;
            }
          }

          // if (chunks[i].getBoundingClientRect().top == 0) {
          //   newTop = chunks[i].getBoundingClientRect().height
          // }

          if (newTop > oldTop) {
            chunks[i].firstElementChild.className = 'idx';
            oldTop = newTop;
          } else {
            chunks[i].firstElementChild.className = 'idx hidden';
          }
      }

      }
    }

  }

}
(window as any).ProSeqViewer = ProSeqViewer; // VERY IMPORTANT AND USEFUL TO BE ABLE TO HAVE A WORKING BUNDLE.JS!! NEVER DELETE THIS LINE
