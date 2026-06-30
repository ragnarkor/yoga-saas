const emptyImageHelper = require("../../../helper/empty_image_helper.js");

Component({
  options: {
    addGlobalClass: true,
    multipleSlots: true,
    styleIsolation: "apply-shared",
  },

  externalClasses: ["custom-class", "image-class", "description-class"],

  properties: {
    image: {
      type: String,
      value: "",
    },
    description: String,
    imageSize: {
      type: null,
      value: "",
    },
  },

  data: {
    displayImage: emptyImageHelper.pickEmptyImage({ relative: true }),
  },

  lifetimes: {
    attached() {
      this._syncImage();
    },
  },

  observers: {
    image() {
      this._syncImage();
    },
  },

  methods: {
    _syncImage() {
      const custom = (this.properties.image || "").trim();
      this.setData({
        displayImage:
          custom || emptyImageHelper.pickEmptyImage({ relative: true }),
      });
    },
  },
});
