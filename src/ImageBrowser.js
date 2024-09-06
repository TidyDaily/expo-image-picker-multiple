import React from "react";
import {
  StyleSheet,
  View,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";

import ImageTile from "./ImageTile";

const { width } = Dimensions.get("window");
const NUM_COLUMNS = 4;

export default class ImageBrowser extends React.Component {
  static defaultProps = {
    loadCompleteMetadata: false,
    loadCount: 50,
    emptyStayComponent: null,
    preloaderComponent: <ActivityIndicator size="large" />,
    mediaType: [MediaLibrary.MediaType.photo],
  };

  state = {
    hasCameraPermission: null,
    hasCameraRollPermission: null,
    photos: [],
    selected: [],
    isEmpty: false,
    after: null,
    hasNextPage: true,
    hasMediaLibraryPermission: null,
  };

  async componentDidMount() {
    await this.getPermissionsAsync();
    this.getPhotos();
  }

  getPermissionsAsync = async () => {
    const { status: camera } = await ImagePicker.requestCameraPermissionsAsync(
      false,
      []
    );
    const { status: cameraRoll } = await MediaLibrary.requestPermissionsAsync(
      false,
      []
    );
    const { status: requestPermissions } =
      await MediaLibrary.requestPermissionsAsync(false, []);

    this.setState({
      hasCameraPermission: camera === "granted",
      hasCameraRollPermission: cameraRoll === "granted",
      hasMediaLibraryPermission: requestPermissions === "granted",
    });
  };

  selectImage = (index) => {
    let newSelected = Array.from(this.state.selected);
    if (newSelected.indexOf(index) === -1) {
      newSelected.push(index);
    } else {
      const deleteIndex = newSelected.indexOf(index);
      newSelected.splice(deleteIndex, 1);
    }
    if (newSelected.length > this.props.max) return;
    if (!newSelected) newSelected = [];
    this.setState({ selected: newSelected }, () => {
      this.props.onChange(newSelected.length, () => this.prepareCallback());
    });
  };

  getPhotos = () => {
    const params = {
      first: this.props.loadCount,
      mediaType: this.props.mediaType,
      sortBy: [MediaLibrary.SortBy.creationTime],
    };
    if (this.state.after) params.after = this.state.after;
    if (!this.state.hasNextPage) return;
    if (this.state.hasMediaLibraryPermission) {
      MediaLibrary.getAssetsAsync(params).then(this.processPhotos);
    }
  };

  processPhotos = async (data) => {
    if (this.state.hasMediaLibraryPermission) {
      if (data.totalCount) {
        if (this.state.after === data.endCursor) return;

        if (data.assets?.length > 0) {
          for (let i = 0; i < data.assets.length; i++) {
            const assetInfo = await MediaLibrary.getAssetInfoAsync(
              data.assets[i].id
            );
            let finalURI = assetInfo.localUri || assetInfo.uri;
            data.assets[i].uri = finalURI;
          }
        }

        const uris = data.assets;
        this.setState({
          photos: [...this.state.photos, ...uris],
          after: data.endCursor,
          hasNextPage: data.hasNextPage,
        });
      } else {
        this.setState({ isEmpty: true });
      }
    }
  };

  getItemLayout = (data, index) => {
    const length = width / 4;
    return { length, offset: length * index, index };
  };

  prepareCallback() {
    const { loadCompleteMetadata } = this.props;
    const { selected, photos } = this.state;
    const selectedPhotos = selected.map((i) => photos[i]);
    if (!loadCompleteMetadata) {
      this.props.callback(Promise.all(selectedPhotos));
    } else {
      const assetsInfo = Promise.all(
        selectedPhotos.map((i) => MediaLibrary.getAssetInfoAsync(i))
      );
      this.props.callback(assetsInfo);
    }
  }

  renderImageTile = ({ item, index }) => {
    const selected = this.state.selected.indexOf(index) !== -1;
    const selectedItemNumber = this.state.selected.indexOf(index) + 1;
    return (
      <ImageTile
        selectedItemNumber={selectedItemNumber}
        item={item}
        index={index}
        selected={selected}
        selectImage={this.selectImage}
        renderSelectedComponent={this.props.renderSelectedComponent}
        renderExtraComponent={this.props.renderExtraComponent}
      />
    );
  };

  renderPreloader = () => this.props.preloaderComponent;

  renderEmptyStay = () => this.props.emptyStayComponent;

  renderImages() {
    return (
      <FlatList
        data={this.state.photos}
        numColumns={NUM_COLUMNS}
        key={NUM_COLUMNS}
        renderItem={this.renderImageTile}
        keyExtractor={(_, index) => index}
        onEndReached={() => this.getPhotos()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          this.state.isEmpty ? this.renderEmptyStay() : this.renderPreloader()
        }
        initialNumToRender={24}
        getItemLayout={this.getItemLayout}
      />
    );
  }

  render() {
    const { hasCameraPermission } = this.state;
    if (!hasCameraPermission)
      return this.props.noCameraPermissionComponent || null;

    return <View style={styles.container}>{this.renderImages()}</View>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
